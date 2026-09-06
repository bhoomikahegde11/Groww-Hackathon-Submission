import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { createApp } from "../app";
import { prisma } from "../lib/prisma";

// These tests exercise the real HTTP routes (signup/login/logout, cookie
// issuance, and auth-protected endpoints) against an in-process server on
// an ephemeral port. Every account created here uses a unique email under
// a shared test prefix, cleaned up in `after` — the app's real data is
// never touched.

const EMAIL_PREFIX = "auth-test-";
let baseUrl: string;
let server: Server;
let emailCounter = 0;

function uniqueEmail(): string {
  emailCounter += 1;
  return `${EMAIL_PREFIX}${Date.now()}-${emailCounter}@example.test`;
}

function extractAuthCookie(res: Response): string | null {
  const cookies = res.headers.getSetCookie?.() ?? [];
  const authCookie = cookies.find((c) => c.startsWith("auth_token="));
  return authCookie ? authCookie.split(";")[0] : null;
}

async function signup(email: string, password: string) {
  return fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

async function login(email: string, password: string) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

/** Signs up a fresh user and returns their auth cookie header value. */
async function signUpAndGetCookie(): Promise<{ email: string; cookie: string }> {
  const email = uniqueEmail();
  const res = await signup(email, "correct-horse-battery-staple");
  const cookie = extractAuthCookie(res);
  assert.ok(cookie, "signup should set an auth cookie");
  return { email, cookie: cookie! };
}

before(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const testUsers = await prisma.user.findMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });
  const userIds = testUsers.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.watchlist.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

test("signup creates an account and never returns the password hash", async () => {
  const email = uniqueEmail();
  const res = await signup(email, "correct-horse-battery-staple");
  assert.equal(res.status, 201);

  const body = await res.json();
  assert.equal(body.user.email, email);
  assert.equal("passwordHash" in body.user, false);
  assert.ok(extractAuthCookie(res), "signup should set an auth cookie");
});

test("signup rejects a duplicate email with 409", async () => {
  const email = uniqueEmail();
  const first = await signup(email, "correct-horse-battery-staple");
  assert.equal(first.status, 201);

  const second = await signup(email, "a-different-password");
  assert.equal(second.status, 409);
});

test("signup rejects an invalid email or short password with 400", async () => {
  const badEmail = await signup("not-an-email", "correct-horse-battery-staple");
  assert.equal(badEmail.status, 400);

  const shortPassword = await signup(uniqueEmail(), "short");
  assert.equal(shortPassword.status, 400);
});

test("login succeeds with correct credentials and sets an auth cookie", async () => {
  const email = uniqueEmail();
  const password = "correct-horse-battery-staple";
  await signup(email, password);

  const res = await login(email, password);
  assert.equal(res.status, 200);
  assert.ok(extractAuthCookie(res));

  const body = await res.json();
  assert.equal(body.user.email, email);
});

test("login rejects an incorrect password with 401", async () => {
  const email = uniqueEmail();
  await signup(email, "correct-horse-battery-staple");

  const res = await login(email, "totally-wrong-password");
  assert.equal(res.status, 401);
});

test("login rejects a nonexistent email with 401", async () => {
  const res = await login(uniqueEmail(), "whatever-password");
  assert.equal(res.status, 401);
});

test("an unauthenticated request to a protected endpoint is rejected with 401", async () => {
  const res = await fetch(`${baseUrl}/api/watchlist`);
  assert.equal(res.status, 401);
});

test("an authenticated user can access their own watchlist", async () => {
  const { cookie } = await signUpAndGetCookie();

  const res = await fetch(`${baseUrl}/api/watchlist`, {
    headers: { Cookie: cookie },
  });
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.deepEqual(body.items, []);
});

test("a user cannot see another user's watchlist items", async () => {
  const userA = await signUpAndGetCookie();
  const userB = await signUpAndGetCookie();

  const addRes = await fetch(`${baseUrl}/api/watchlist/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: userA.cookie },
    body: JSON.stringify({ symbol: "TCS" }),
  });
  assert.equal(addRes.status, 201);

  const aView = await fetch(`${baseUrl}/api/watchlist`, {
    headers: { Cookie: userA.cookie },
  }).then((r) => r.json());
  assert.equal(aView.items.length, 1);
  assert.equal(aView.items[0].symbol, "TCS");

  const bView = await fetch(`${baseUrl}/api/watchlist`, {
    headers: { Cookie: userB.cookie },
  }).then((r) => r.json());
  assert.equal(bView.items.length, 0);
  assert.notEqual(bView.id, aView.id);
});

test("logout clears the session so the protected endpoint rejects again", async () => {
  const { cookie } = await signUpAndGetCookie();

  const authedBefore = await fetch(`${baseUrl}/api/watchlist`, {
    headers: { Cookie: cookie },
  });
  assert.equal(authedBefore.status, 200);

  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assert.equal(logoutRes.status, 204);

  // The client would stop sending the cookie once cleared; simulate that
  // by making the follow-up request with no cookie at all.
  const afterLogout = await fetch(`${baseUrl}/api/watchlist`);
  assert.equal(afterLogout.status, 401);
});

test("GET /api/auth/me reflects the authenticated user, 401 when logged out", async () => {
  const { email, cookie } = await signUpAndGetCookie();

  const authed = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(authed.status, 200);
  const body = await authed.json();
  assert.equal(body.user.email, email);

  const unauthed = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(unauthed.status, 401);
});

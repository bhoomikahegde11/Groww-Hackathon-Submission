import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { createApp } from "../app";
import { prisma } from "../lib/prisma";

// HTTP-level tests for GET /api/market/history, against an in-process
// server on an ephemeral port. Uses one throwaway account (cleaned up in
// `after`) purely to obtain an auth cookie — history itself never touches
// the database.

const EMAIL_PREFIX = "history-test-";
let baseUrl: string;
let server: Server;
let authCookie: string;

function extractAuthCookie(res: Response): string | null {
  const cookies = res.headers.getSetCookie?.() ?? [];
  const authCookie = cookies.find((c) => c.startsWith("auth_token="));
  return authCookie ? authCookie.split(";")[0] : null;
}

before(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;

  const email = `${EMAIL_PREFIX}${Date.now()}@example.test`;
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct-horse-battery-staple" }),
  });
  authCookie = extractAuthCookie(res)!;
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

test("an unauthenticated history request is rejected with 401", async () => {
  const res = await fetch(`${baseUrl}/api/market/history?symbol=TCS`);
  assert.equal(res.status, 401);
});

test("a valid, known symbol returns ~30 points", async () => {
  const res = await fetch(`${baseUrl}/api/market/history?symbol=TCS`, {
    headers: { Cookie: authCookie },
  });
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.symbol, "TCS");
  assert.equal(body.found, true);
  assert.equal(body.points.length, 30);
  assert.ok(body.points[0].date < body.points[body.points.length - 1].date);
});

test("history is deterministic across repeated authenticated requests", async () => {
  const first = await fetch(`${baseUrl}/api/market/history?symbol=INFY`, {
    headers: { Cookie: authCookie },
  }).then((r) => r.json());
  const second = await fetch(`${baseUrl}/api/market/history?symbol=INFY`, {
    headers: { Cookie: authCookie },
  }).then((r) => r.json());
  assert.deepEqual(first, second);
});

test("an invalid symbol format returns 400", async () => {
  const res = await fetch(`${baseUrl}/api/market/history?symbol=$$bad`, {
    headers: { Cookie: authCookie },
  });
  assert.equal(res.status, 400);
});

test("a well-formed but unsupported symbol returns a clean 404, not a crash", async () => {
  const res = await fetch(`${baseUrl}/api/market/history?symbol=ZZZZZ`, {
    headers: { Cookie: authCookie },
  });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.error, /ZZZZZ/);
});

test("a missing symbol query param returns 400", async () => {
  const res = await fetch(`${baseUrl}/api/market/history`, {
    headers: { Cookie: authCookie },
  });
  assert.equal(res.status, 400);
});

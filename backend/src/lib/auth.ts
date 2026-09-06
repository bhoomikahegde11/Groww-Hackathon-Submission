import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Hackathon-appropriate default so `npm run dev` works out of the box;
// set a real secret via the JWT_SECRET env var for anything beyond local use.
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me";
const TOKEN_TTL = "7d";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const AUTH_COOKIE_NAME = "auth_token";

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TOKEN_TTL_MS,
};

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function validatePassword(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length < PASSWORD_MIN_LENGTH) return null;
  return raw;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAuthToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyAuthToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "object" && payload !== null && typeof payload.sub === "string") {
      return { userId: payload.sub };
    }
    return null;
  } catch {
    return null;
  }
}

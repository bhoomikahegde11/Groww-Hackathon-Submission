import { Prisma } from "@prisma/client";
import { Router } from "express";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  hashPassword,
  normalizeEmail,
  signAuthToken,
  validatePassword,
  verifyPassword,
} from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { prisma } from "../lib/prisma";
import { getUserIdFromRequest } from "../lib/requireAuth";

export const authRouter = Router();

function publicUser(user: { id: string; email: string }) {
  return { id: user.id, email: user.email };
}

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = validatePassword(req.body?.password);

    if (!email || !password) {
      res.status(400).json({
        error: "Enter a valid email and a password of at least 8 characters.",
      });
      return;
    }

    const passwordHash = await hashPassword(password);

    let user;
    try {
      user = await prisma.user.create({ data: { email, passwordHash } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        res.status(409).json({ error: "An account with that email already exists." });
        return;
      }
      throw error;
    }

    const token = signAuthToken(user.id);
    res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
    res.status(201).json({ user: publicUser(user) });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : null;

    if (!email || !password) {
      res.status(400).json({ error: "Enter an email and password." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = signAuthToken(user.id);
    res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { ...AUTH_COOKIE_OPTIONS, maxAge: undefined });
  res.status(204).send();
});

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }

    res.json({ user: publicUser(user) });
  }),
);

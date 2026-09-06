import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "./auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function getUserIdFromRequest(req: Request): string | null {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof token !== "string") return null;
  const result = verifyAuthToken(token);
  return result?.userId ?? null;
}

/** Rejects unauthenticated requests with 401; otherwise sets req.userId. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  req.userId = userId;
  next();
}

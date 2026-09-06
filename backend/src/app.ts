import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";
import { marketRouter } from "./routes/market";
import { watchlistRouter } from "./routes/watchlist";

export function createApp() {
  const app = express();

  // credentials:true + an explicit origin (not "*") is required for the
  // auth cookie to be sent/accepted cross-origin (frontend:5173 -> backend:4000).
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/watchlist", watchlistRouter);
  app.use("/api/market", marketRouter);

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

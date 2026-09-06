import { Prisma } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/requireAuth";
import { getOrCreateWatchlistForUser } from "../lib/userWatchlist";

export const watchlistRouter = Router();

watchlistRouter.use(requireAuth);

const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

function normalizeSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const symbol = raw.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) return null;
  return symbol;
}

watchlistRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const watchlist = await getOrCreateWatchlistForUser(req.userId!);
    const items = await prisma.watchlistItem.findMany({
      where: { watchlistId: watchlist.id },
      orderBy: { addedAt: "asc" },
    });
    res.json({ id: watchlist.id, name: watchlist.name, items });
  }),
);

watchlistRouter.post(
  "/items",
  asyncHandler(async (req, res) => {
    const symbol = normalizeSymbol(req.body?.symbol);
    if (!symbol) {
      res.status(400).json({
        error:
          "Invalid symbol. Use 1-10 characters: letters, numbers, '.' or '-', starting with a letter.",
      });
      return;
    }

    const watchlist = await getOrCreateWatchlistForUser(req.userId!);

    try {
      const item = await prisma.watchlistItem.create({
        data: { watchlistId: watchlist.id, symbol },
      });
      res.status(201).json(item);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        res.status(409).json({ error: `${symbol} is already on the watchlist.` });
        return;
      }
      throw error;
    }
  }),
);

watchlistRouter.delete(
  "/items/:symbol",
  asyncHandler(async (req, res) => {
    const symbol = normalizeSymbol(req.params.symbol);
    if (!symbol) {
      res.status(400).json({ error: "Invalid symbol." });
      return;
    }

    const watchlist = await getOrCreateWatchlistForUser(req.userId!);

    const deleted = await prisma.watchlistItem.deleteMany({
      where: { watchlistId: watchlist.id, symbol },
    });

    if (deleted.count === 0) {
      res.status(404).json({ error: `${symbol} is not on the watchlist.` });
      return;
    }

    res.status(204).send();
  }),
);

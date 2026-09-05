import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { getDefaultWatchlist } from "../lib/defaultWatchlist";
import { prisma } from "../lib/prisma";
import { acknowledgeSnapshot, getSnapshotView } from "../lib/snapshotService";
import { marketDataProvider } from "../marketData";

export const marketRouter = Router();

marketRouter.get(
  "/quotes",
  asyncHandler(async (_req, res) => {
    const watchlist = await getDefaultWatchlist();
    const items = await prisma.watchlistItem.findMany({
      where: { watchlistId: watchlist.id },
      orderBy: { addedAt: "asc" },
    });

    const symbols = items.map((item) => item.symbol);
    const quotes = await marketDataProvider.getQuotes(symbols);

    res.json({ quotes });
  }),
);

marketRouter.get(
  "/snapshot",
  asyncHandler(async (_req, res) => {
    const watchlist = await getDefaultWatchlist();
    const view = await getSnapshotView(watchlist.id);
    res.json(view);
  }),
);

marketRouter.post(
  "/snapshot/ack",
  asyncHandler(async (_req, res) => {
    const watchlist = await getDefaultWatchlist();
    const acknowledged = await acknowledgeSnapshot(watchlist.id);
    res.json({ acknowledged });
  }),
);

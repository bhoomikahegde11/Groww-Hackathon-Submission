import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { getDefaultWatchlist } from "../lib/defaultWatchlist";
import { prisma } from "../lib/prisma";
import { getSnapshotPreview } from "../lib/snapshotPreview";
import { acknowledgeSnapshot, getSnapshotView } from "../lib/snapshotService";
import { marketDataProvider } from "../marketData";
import { parseScenarioParam } from "../marketData/scenarioParam";

export const marketRouter = Router();

marketRouter.get(
  "/quotes",
  asyncHandler(async (req, res) => {
    const parsedScenario = parseScenarioParam(req.query.scenario);
    if (!parsedScenario.ok) {
      res.status(400).json({ error: parsedScenario.error });
      return;
    }

    const watchlist = await getDefaultWatchlist();
    const items = await prisma.watchlistItem.findMany({
      where: { watchlistId: watchlist.id },
      orderBy: { addedAt: "asc" },
    });

    const symbols = items.map((item) => item.symbol);
    const quotes = await marketDataProvider.getQuotes(symbols, {
      scenario: parsedScenario.scenario,
    });

    res.json({ quotes });
  }),
);

marketRouter.get(
  "/snapshot",
  asyncHandler(async (req, res) => {
    const parsedScenario = parseScenarioParam(req.query.scenario);
    if (!parsedScenario.ok) {
      res.status(400).json({ error: parsedScenario.error });
      return;
    }

    const watchlist = await getDefaultWatchlist();
    const view = await getSnapshotView(watchlist.id, {
      scenario: parsedScenario.scenario,
    });
    res.json(view);
  }),
);

// Read-only: for manually/dev-previewing the "while you were away" UI under
// a chosen scenario. Never writes to WatchlistItem/WatchlistSnapshot, so it
// cannot create a pending snapshot, advance a baseline, or otherwise affect
// the real snapshot lifecycle.
marketRouter.get(
  "/snapshot/preview",
  asyncHandler(async (req, res) => {
    const parsedScenario = parseScenarioParam(req.query.scenario);
    if (!parsedScenario.ok) {
      res.status(400).json({ error: parsedScenario.error });
      return;
    }

    const watchlist = await getDefaultWatchlist();
    const changes = await getSnapshotPreview(watchlist.id, {
      scenario: parsedScenario.scenario,
    });
    res.json({ scenario: parsedScenario.scenario ?? "normal", changes });
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

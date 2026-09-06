import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/requireAuth";
import { getSnapshotPreview } from "../lib/snapshotPreview";
import { acknowledgeSnapshot, getSnapshotView } from "../lib/snapshotService";
import { normalizeSymbol } from "../lib/symbol";
import { getOrCreateWatchlistForUser } from "../lib/userWatchlist";
import { marketDataProvider } from "../marketData";
import { parseScenarioParam } from "../marketData/scenarioParam";

export const marketRouter = Router();

marketRouter.use(requireAuth);

marketRouter.get(
  "/quotes",
  asyncHandler(async (req, res) => {
    const parsedScenario = parseScenarioParam(req.query.scenario);
    if (!parsedScenario.ok) {
      res.status(400).json({ error: parsedScenario.error });
      return;
    }

    // Dev/testing only: lets a developer manually trigger a complete
    // provider outage or specific per-symbol failures from the browser,
    // without ever happening on a normal request. See MockMarketDataProvider.
    const simulateProviderFailure = req.query.simulateProviderFailure === "true";
    const failSymbolsParam = req.query.failSymbols;
    const failSymbols =
      typeof failSymbolsParam === "string"
        ? failSymbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : undefined;

    const watchlist = await getOrCreateWatchlistForUser(req.userId!);
    const items = await prisma.watchlistItem.findMany({
      where: { watchlistId: watchlist.id },
      orderBy: { addedAt: "asc" },
    });

    const symbols = items.map((item) => item.symbol);

    let quotes;
    try {
      quotes = await marketDataProvider.getQuotes(symbols, {
        scenario: parsedScenario.scenario,
        simulateProviderFailure,
        failSymbols,
      });
    } catch {
      res.status(503).json({
        error: "Market data provider is currently unavailable.",
        quotes: [],
      });
      return;
    }

    res.json({ quotes });
  }),
);

// Read-only ~30-day daily-close history for one symbol, independent of the
// watchlist/snapshot/last-seen machinery entirely — it doesn't touch the
// database at all.
marketRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const symbol = normalizeSymbol(req.query.symbol);
    if (!symbol) {
      res.status(400).json({
        error:
          "Invalid symbol. Use 1-10 characters: letters, numbers, '.' or '-', starting with a letter.",
      });
      return;
    }

    const history = await marketDataProvider.getHistory(symbol);
    if (!history.found) {
      res.status(404).json({ error: `No historical data for ${symbol}.` });
      return;
    }

    res.json(history);
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

    const watchlist = await getOrCreateWatchlistForUser(req.userId!);
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

    const watchlist = await getOrCreateWatchlistForUser(req.userId!);
    const changes = await getSnapshotPreview(watchlist.id, {
      scenario: parsedScenario.scenario,
    });
    res.json({ scenario: parsedScenario.scenario ?? "normal", changes });
  }),
);

marketRouter.post(
  "/snapshot/ack",
  asyncHandler(async (req, res) => {
    const watchlist = await getOrCreateWatchlistForUser(req.userId!);
    const acknowledged = await acknowledgeSnapshot(watchlist.id);
    res.json({ acknowledged });
  }),
);

import type { WatchlistItem } from "@prisma/client";
import { rankChangesByAttention } from "../marketData/attentionScoring";
import {
  detectWatchlistChanges,
  type ItemChangeSummary,
  type ItemComparisonInput,
} from "../marketData/changeDetection";
import { marketDataProvider } from "../marketData";
import type { MarketDataQueryOptions, Quote } from "../marketData";
import { prisma } from "./prisma";

interface StoredItemState {
  symbol: string;
  price: number;
  volume: number;
  weekHigh52: number;
  weekLow52: number;
}

interface StoredSnapshotPayload {
  items: StoredItemState[];
  changes: ItemChangeSummary[];
}

export interface PublicChange {
  symbol: string;
  name: string;
  changePercent: number;
  primaryLabel: string;
  labels: string[];
}

export type SnapshotView =
  | { kind: "first-visit" }
  | { kind: "no-changes" }
  | {
      kind: "while-you-were-away";
      comparedAt: string;
      previousCheckedAt: string | null;
      changes: PublicChange[];
    }
  | {
      kind: "since-last-visit";
      comparedAt: string;
      changes: PublicChange[];
    };

function toPublicChange(change: ItemChangeSummary): PublicChange {
  return {
    symbol: change.symbol,
    name: change.name,
    changePercent: change.changePercent,
    primaryLabel: change.flags[0].label,
    labels: change.flags.map((f) => f.label),
  };
}

async function fetchQuoteMap(
  symbols: string[],
  options?: MarketDataQueryOptions,
): Promise<Map<string, Quote>> {
  const results = await marketDataProvider.getQuotes(symbols, options);
  const map = new Map<string, Quote>();
  for (const result of results) {
    if (result.found) map.set(result.symbol, result.quote);
  }
  return map;
}

/**
 * Silently establishes a baseline for any watchlist item that has never
 * been seen before (new item, or true first visit), so future visits have
 * something to compare against. This never surfaces a "while you were
 * away" banner on its own.
 */
async function initializeMissingBaselines(
  items: WatchlistItem[],
  quotes: Map<string, Quote>,
): Promise<void> {
  const toInit = items.filter(
    (item) => item.lastSeenAt === null && quotes.has(item.symbol),
  );
  if (toInit.length === 0) return;

  await Promise.all(
    toInit.map((item) => {
      const quote = quotes.get(item.symbol)!;
      return prisma.watchlistItem.update({
        where: { id: item.id },
        data: {
          lastSeenPrice: quote.lastPrice,
          lastSeenVolume: quote.volume,
          lastSeenWeekHigh52: quote.weekHigh52,
          lastSeenWeekLow52: quote.weekLow52,
          lastSeenAt: new Date(),
        },
      });
    }),
  );
}

export async function getSnapshotView(
  watchlistId: string,
  options?: MarketDataQueryOptions,
): Promise<SnapshotView> {
  const items = await prisma.watchlistItem.findMany({ where: { watchlistId } });
  const hadAnyBaseline = items.some((item) => item.lastSeenAt !== null);
  const quotes = await fetchQuoteMap(
    items.map((item) => item.symbol),
    options,
  );

  await initializeMissingBaselines(items, quotes);

  const existing = await prisma.watchlistSnapshot.findUnique({
    where: { watchlistId },
  });

  // A pending (unacknowledged) snapshot is stable: keep showing the same
  // comparison until the user acknowledges it, rather than recomputing it
  // (and potentially changing) on every page load.
  if (existing && !existing.acknowledged) {
    const payload: StoredSnapshotPayload = JSON.parse(existing.payload);
    return {
      kind: "while-you-were-away",
      comparedAt: existing.comparedAt.toISOString(),
      previousCheckedAt: previousCheckedAt(items),
      changes: payload.changes.map(toPublicChange),
    };
  }

  if (!hadAnyBaseline) {
    return { kind: "first-visit" };
  }

  const comparisonInputs: ItemComparisonInput[] = items
    .filter((item) => item.lastSeenAt !== null)
    .map((item) => ({
      symbol: item.symbol,
      name: quotes.get(item.symbol)?.name ?? item.symbol,
      previous: {
        price: item.lastSeenPrice!,
        volume: item.lastSeenVolume!,
        weekHigh52: item.lastSeenWeekHigh52!,
        weekLow52: item.lastSeenWeekLow52!,
      },
      current: quotes.has(item.symbol)
        ? {
            price: quotes.get(item.symbol)!.lastPrice,
            volume: quotes.get(item.symbol)!.volume,
            weekHigh52: quotes.get(item.symbol)!.weekHigh52,
            weekLow52: quotes.get(item.symbol)!.weekLow52,
          }
        : null,
    }));

  // Rank by explainable attention score before this ordering is persisted
  // or returned — detection decides *what* is meaningful, scoring decides
  // *how much attention* it deserves.
  const changes = rankChangesByAttention(detectWatchlistChanges(comparisonInputs)).map(
    (ranked) => ranked.change,
  );

  if (changes.length === 0) {
    if (existing) {
      const payload: StoredSnapshotPayload = JSON.parse(existing.payload);
      return {
        kind: "since-last-visit",
        comparedAt: (existing.acknowledgedAt ?? existing.comparedAt).toISOString(),
        changes: payload.changes.map(toPublicChange),
      };
    }
    return { kind: "no-changes" };
  }

  const currentItemsPayload: StoredItemState[] = items
    .filter((item) => quotes.has(item.symbol))
    .map((item) => {
      const quote = quotes.get(item.symbol)!;
      return {
        symbol: item.symbol,
        price: quote.lastPrice,
        volume: quote.volume,
        weekHigh52: quote.weekHigh52,
        weekLow52: quote.weekLow52,
      };
    });

  const payload: StoredSnapshotPayload = { items: currentItemsPayload, changes };

  const snapshot = await prisma.watchlistSnapshot.upsert({
    where: { watchlistId },
    create: {
      watchlistId,
      payload: JSON.stringify(payload),
      acknowledged: false,
    },
    update: {
      payload: JSON.stringify(payload),
      acknowledged: false,
      acknowledgedAt: null,
      comparedAt: new Date(),
    },
  });

  return {
    kind: "while-you-were-away",
    comparedAt: snapshot.comparedAt.toISOString(),
    previousCheckedAt: previousCheckedAt(items),
    changes: changes.map(toPublicChange),
  };
}

function previousCheckedAt(items: WatchlistItem[]): string | null {
  const timestamps = items
    .map((item) => item.lastSeenAt)
    .filter((d): d is Date => d !== null);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps.map((d) => d.getTime()))).toISOString();
}

/**
 * Marks the current pending snapshot as acknowledged and advances every
 * item's last-seen baseline to the values captured when the snapshot was
 * created — not values re-fetched now — so a second (e.g. duplicate/auto)
 * acknowledgement can't clobber the baseline with different data. Runs in
 * a transaction so concurrent calls can't interleave.
 */
export async function acknowledgeSnapshot(watchlistId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.watchlistSnapshot.findUnique({
      where: { watchlistId },
    });
    if (!snapshot || snapshot.acknowledged) return false;

    const payload: StoredSnapshotPayload = JSON.parse(snapshot.payload);
    const now = new Date();

    for (const item of payload.items) {
      await tx.watchlistItem.updateMany({
        where: { watchlistId, symbol: item.symbol },
        data: {
          lastSeenPrice: item.price,
          lastSeenVolume: item.volume,
          lastSeenWeekHigh52: item.weekHigh52,
          lastSeenWeekLow52: item.weekLow52,
          lastSeenAt: now,
        },
      });
    }

    await tx.watchlistSnapshot.update({
      where: { watchlistId },
      data: { acknowledged: true, acknowledgedAt: now },
    });

    return true;
  });
}

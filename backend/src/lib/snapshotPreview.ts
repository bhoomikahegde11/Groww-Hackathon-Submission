import { rankChangesByAttention } from "../marketData/attentionScoring";
import {
  detectWatchlistChanges,
  type ItemComparisonInput,
} from "../marketData/changeDetection";
import { marketDataProvider } from "../marketData";
import type { MarketDataQueryOptions } from "../marketData";
import { prisma } from "./prisma";

export interface PreviewChange {
  symbol: string;
  name: string;
  changePercent: number;
  primaryLabel: string;
  labels: string[];
}

/**
 * Read-only preview of what the "while you were away" summary would look
 * like right now under a given simulator scenario, for manual/dev UI
 * testing only. Reuses the existing detection + scoring logic exactly as
 * written (nothing here duplicates or reimplements those rules) but never
 * writes to WatchlistItem or WatchlistSnapshot — it does not touch
 * baselines, does not create a pending snapshot, and cannot be
 * acknowledged. The real snapshot lifecycle is completely unaffected by
 * calling this.
 */
export async function getSnapshotPreview(
  watchlistId: string,
  options?: MarketDataQueryOptions,
): Promise<PreviewChange[]> {
  const items = await prisma.watchlistItem.findMany({ where: { watchlistId } });

  const results = await marketDataProvider.getQuotes(
    items.map((item) => item.symbol),
    options,
  );
  const quotes = new Map(
    results.filter((r) => r.found).map((r) => [r.symbol, r.quote]),
  );

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

  const ranked = rankChangesByAttention(detectWatchlistChanges(comparisonInputs));

  return ranked.map(({ change }) => ({
    symbol: change.symbol,
    name: change.name,
    changePercent: change.changePercent,
    primaryLabel: change.flags[0].label,
    labels: change.flags.map((f) => f.label),
  }));
}

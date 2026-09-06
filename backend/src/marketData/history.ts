import { buildQuote, round2 } from "./quoteMath";
import { createRng } from "./rng";
import { STOCK_SEEDS, type StockSeed } from "./seedStocks";

export interface HistoryPoint {
  /** ISO date (YYYY-MM-DD), oldest first. */
  date: string;
  close: number;
}

export type HistoryResult =
  | { symbol: string; found: true; points: HistoryPoint[] }
  | { symbol: string; found: false };

const HISTORY_LENGTH = 30;
// Daily move range for the simulated walk between historical points —
// independent of (and narrower than) the single-day scenario ranges in
// scenarios.ts, since this represents ordinary day-to-day drift rather
// than "today's" demoed event.
const DAILY_CHANGE_RANGE: [number, number] = [-0.018, 0.018];

const SEED_BY_SYMBOL = new Map(STOCK_SEEDS.map((seed) => [seed.symbol, seed]));

/**
 * Builds a deterministic ~30-day daily-close history ending exactly at
 * today's simulated quote price (the seed's own default scenario, not any
 * per-request override), so the chart's latest point always agrees with
 * what the quote endpoints show. Walks backward from today using a
 * separate RNG stream (keyed by `${symbol}:history`) so it never consumes
 * — or is affected by — the quote's own RNG sequence.
 */
function buildHistory(seed: StockSeed): HistoryPoint[] {
  const quote = buildQuote(seed);
  const rng = createRng(`${seed.symbol}:history`);

  const closesFromToday: number[] = [quote.lastPrice];
  let current = quote.lastPrice;
  for (let i = 1; i < HISTORY_LENGTH; i++) {
    const [min, max] = DAILY_CHANGE_RANGE;
    const dailyReturn = min + rng() * (max - min);
    current = current / (1 + dailyReturn);
    closesFromToday.push(current);
  }

  const today = new Date();
  return closesFromToday
    .map((close, daysAgo) => {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - daysAgo);
      return { date: date.toISOString().slice(0, 10), close: round2(close) };
    })
    .reverse(); // oldest -> newest
}

export function getHistory(symbol: string): HistoryResult {
  const seed = SEED_BY_SYMBOL.get(symbol);
  if (!seed) return { symbol, found: false };
  return { symbol, found: true, points: buildHistory(seed) };
}

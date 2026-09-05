/**
 * Pure "meaningful change" rules, independent of Express/Prisma so they can
 * be unit-tested and tuned without touching routes or persistence.
 */

export interface BaselineState {
  price: number;
  volume: number;
  weekHigh52: number;
  weekLow52: number;
}

export interface CurrentState {
  price: number;
  volume: number;
  weekHigh52: number;
  weekLow52: number;
}

export type ChangeType =
  | "significant-price-move"
  | "new-52w-high"
  | "new-52w-low"
  | "unusual-volume";

export interface ChangeFlag {
  type: ChangeType;
  label: string;
}

export interface ItemChangeSummary {
  symbol: string;
  name: string;
  previous: BaselineState;
  current: CurrentState;
  changePercent: number;
  flags: ChangeFlag[];
}

export interface ItemComparisonInput {
  symbol: string;
  name: string;
  previous: BaselineState | null;
  current: CurrentState | null;
}

// Thresholds for what counts as "meaningful". Deliberately simple,
// hand-picked rules — easy to tune or replace without touching call sites.
export const THRESHOLDS = {
  significantPriceMovePct: 3, // +/-3% from last-seen price
  unusualVolumeMultiplier: 2, // 2x last-seen volume
};

const FLAG_PRIORITY: ChangeType[] = [
  "new-52w-high",
  "new-52w-low",
  "significant-price-move",
  "unusual-volume",
];

const FLAG_LABELS: Record<ChangeType, string> = {
  "significant-price-move": "Significant price movement",
  "new-52w-high": "New 52-week high",
  "new-52w-low": "New 52-week low",
  "unusual-volume": "Unusual volume",
};

/**
 * Compares one symbol's previous (last-seen) and current market state and
 * returns the meaningful changes found, or null if nothing meaningful
 * changed (or either state is unavailable).
 */
export function detectItemChange(
  input: ItemComparisonInput,
): ItemChangeSummary | null {
  const { previous, current } = input;
  if (!previous || !current) return null;
  if (previous.price <= 0) return null;

  const changePercent = ((current.price - previous.price) / previous.price) * 100;
  const flags: ChangeFlag[] = [];

  if (Math.abs(changePercent) >= THRESHOLDS.significantPriceMovePct) {
    flags.push({ type: "significant-price-move", label: FLAG_LABELS["significant-price-move"] });
  }

  if (current.weekHigh52 > previous.weekHigh52) {
    flags.push({ type: "new-52w-high", label: FLAG_LABELS["new-52w-high"] });
  }

  if (current.weekLow52 < previous.weekLow52) {
    flags.push({ type: "new-52w-low", label: FLAG_LABELS["new-52w-low"] });
  }

  if (
    previous.volume > 0 &&
    current.volume >= previous.volume * THRESHOLDS.unusualVolumeMultiplier
  ) {
    flags.push({ type: "unusual-volume", label: FLAG_LABELS["unusual-volume"] });
  }

  if (flags.length === 0) return null;

  flags.sort(
    (a, b) => FLAG_PRIORITY.indexOf(a.type) - FLAG_PRIORITY.indexOf(b.type),
  );

  return {
    symbol: input.symbol,
    name: input.name,
    previous,
    current,
    changePercent,
    flags,
  };
}

/**
 * Runs detectItemChange across a watchlist and returns only the symbols
 * with meaningful changes, ordered by largest absolute price move first.
 */
export function detectWatchlistChanges(
  inputs: ItemComparisonInput[],
): ItemChangeSummary[] {
  const changes: ItemChangeSummary[] = [];
  for (const input of inputs) {
    const change = detectItemChange(input);
    if (change) changes.push(change);
  }
  return changes.sort(
    (a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent),
  );
}

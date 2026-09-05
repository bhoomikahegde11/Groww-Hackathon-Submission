import type { ItemChangeSummary } from "./changeDetection";

/**
 * Explainable attention scoring for already-detected changes. This is a
 * ranking concern, separate from `changeDetection.ts` (which decides
 * *whether* something is meaningful) — this only decides *how much
 * attention* a meaningful change deserves, purely from the numeric fields
 * already on `ItemChangeSummary`. No new thresholds are invented here that
 * aren't given by the scoring rules below, and no bonus is added merely for
 * having multiple signals — the score is just the sum of what each signal
 * independently earns.
 */

const PRICE_MOVE_SCORES = [
  { min: 10, score: 4 },
  { min: 5, score: 3 },
  { min: 3, score: 2 },
] as const;

const VOLUME_RATIO_SCORES = [
  { min: 3, score: 3 },
  { min: 2, score: 2 },
] as const;

const WEEK_BOUNDARY_SCORE = 2;

export function scoreChange(change: ItemChangeSummary): number {
  let score = 0;

  const absChangePercent = Math.abs(change.changePercent);
  for (const band of PRICE_MOVE_SCORES) {
    if (absChangePercent >= band.min) {
      score += band.score;
      break;
    }
  }

  const { previous, current } = change;
  if (previous.volume > 0) {
    const volumeRatio = current.volume / previous.volume;
    for (const band of VOLUME_RATIO_SCORES) {
      if (volumeRatio >= band.min) {
        score += band.score;
        break;
      }
    }
  }

  if (current.weekHigh52 > previous.weekHigh52) score += WEEK_BOUNDARY_SCORE;
  if (current.weekLow52 < previous.weekLow52) score += WEEK_BOUNDARY_SCORE;

  return score;
}

export interface ScoredChange {
  change: ItemChangeSummary;
  score: number;
}

/**
 * Scores every change and sorts descending by attention score. Ties break
 * on largest absolute price movement, then alphabetically by symbol, so
 * ordering is fully deterministic.
 */
export function rankChangesByAttention(
  changes: ItemChangeSummary[],
): ScoredChange[] {
  return changes
    .map((change) => ({ change, score: scoreChange(change) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const absA = Math.abs(a.change.changePercent);
      const absB = Math.abs(b.change.changePercent);
      if (absB !== absA) return absB - absA;

      return a.change.symbol.localeCompare(b.change.symbol);
    });
}

/**
 * A scenario controls how a symbol's simulated quote is derived from its
 * seed data. New scenarios can be added here and assigned to a stock in
 * `seedStocks.ts` without changing the simulation logic itself.
 */
export type Scenario =
  | "normal"
  | "significant-move"
  | "high-volume"
  | "52w-high-cross"
  | "52w-low-cross";

export interface ScenarioProfile {
  /** Range for % change from previous close, e.g. [-0.015, 0.015] = +/-1.5%. */
  changeRange: [number, number];
  /** Range multiplier applied to the stock's average volume. */
  volumeMultiplier: [number, number];
  /** Forces today's price to punch through the 52-week high or low. */
  forceWeekBoundary?: "high" | "low";
}

export const SCENARIOS: Record<Scenario, ScenarioProfile> = {
  normal: {
    changeRange: [-0.015, 0.015],
    volumeMultiplier: [0.7, 1.3],
  },
  "significant-move": {
    changeRange: [0.04, 0.08],
    volumeMultiplier: [1.5, 2.5],
  },
  "high-volume": {
    changeRange: [-0.02, 0.02],
    volumeMultiplier: [3, 5],
  },
  "52w-high-cross": {
    changeRange: [0.02, 0.05],
    volumeMultiplier: [1.5, 2.5],
    forceWeekBoundary: "high",
  },
  "52w-low-cross": {
    changeRange: [-0.05, -0.02],
    volumeMultiplier: [1.5, 2.5],
    forceWeekBoundary: "low",
  },
};

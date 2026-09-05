import { SCENARIOS, type Scenario } from "./scenarios";

export const VALID_SCENARIOS = Object.keys(SCENARIOS) as Scenario[];

export type ScenarioParamResult =
  | { ok: true; scenario: Scenario | undefined }
  | { ok: false; error: string };

/**
 * Parses the `scenario` query-string parameter for GET /api/market/quotes.
 * Omitted -> ok with scenario undefined, preserving each seed's own default.
 * Anything other than a known scenario name -> ok:false with a message
 * listing the supported values, so the route can return 400 explicitly
 * instead of silently falling back to normal behavior.
 */
export function parseScenarioParam(value: unknown): ScenarioParamResult {
  if (value === undefined) return { ok: true, scenario: undefined };

  if (typeof value === "string" && isScenario(value)) {
    return { ok: true, scenario: value };
  }

  return {
    ok: false,
    error: `Invalid scenario. Supported values: ${VALID_SCENARIOS.join(", ")}`,
  };
}

function isScenario(value: string): value is Scenario {
  return Object.prototype.hasOwnProperty.call(SCENARIOS, value);
}

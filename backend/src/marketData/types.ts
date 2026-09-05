import type { Scenario } from "./scenarios";

export interface Quote {
  symbol: string;
  name: string;
  lastPrice: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  weekHigh52: number;
  weekLow52: number;
  /** ISO timestamp of when this quote was generated/fetched. */
  asOf: string;
}

export type QuoteResult =
  | { symbol: string; found: true; quote: Quote }
  | { symbol: string; found: false };

export interface MarketDataQueryOptions {
  /**
   * Overrides each requested symbol's default scenario for this call.
   * Mock-provider specific (used to demo a scenario on demand); a real
   * provider implementation is free to ignore it.
   */
  scenario?: Scenario;
  /**
   * Dev/testing only: forces getQuotes to reject entirely, simulating a
   * complete market-data provider outage. Deterministic (only happens when
   * explicitly set) — never triggers on its own. A real provider
   * implementation is free to ignore this.
   */
  simulateProviderFailure?: boolean;
  /**
   * Dev/testing only: forces these specific symbols to come back as
   * `found: false`, simulating a partial/per-symbol data failure even for
   * otherwise-valid symbols. A real provider implementation is free to
   * ignore this.
   */
  failSymbols?: string[];
}

/**
 * Contract for retrieving market data for a set of symbols.
 * The rest of the backend depends on this interface, not on any
 * particular implementation, so a real market-data API can later
 * be swapped in behind it without touching callers.
 */
export interface MarketDataProvider {
  getQuotes(
    symbols: string[],
    options?: MarketDataQueryOptions,
  ): Promise<QuoteResult[]>;
}

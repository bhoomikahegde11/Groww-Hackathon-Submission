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

/**
 * Contract for retrieving market data for a set of symbols.
 * The rest of the backend depends on this interface, not on any
 * particular implementation, so a real market-data API can later
 * be swapped in behind it without touching callers.
 */
export interface MarketDataProvider {
  getQuotes(symbols: string[]): Promise<QuoteResult[]>;
}

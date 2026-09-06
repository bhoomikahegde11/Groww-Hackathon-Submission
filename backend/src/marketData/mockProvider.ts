import { getHistory } from "./history";
import { buildQuote } from "./quoteMath";
import { STOCK_SEEDS } from "./seedStocks";
import type {
  HistoryResult,
  MarketDataProvider,
  MarketDataQueryOptions,
  QuoteResult,
} from "./types";

const SEED_BY_SYMBOL = new Map(STOCK_SEEDS.map((seed) => [seed.symbol, seed]));

/**
 * Simulated market-data source. Quotes are derived deterministically from
 * each symbol's seed data and scenario, so repeated calls for the same
 * symbol return the same market state instead of drifting randomly.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  async getQuotes(
    symbols: string[],
    options?: MarketDataQueryOptions,
  ): Promise<QuoteResult[]> {
    if (options?.simulateProviderFailure) {
      throw new Error("Simulated market data provider failure");
    }

    const failSymbols = new Set(options?.failSymbols ?? []);

    return symbols.map((symbol) => {
      if (failSymbols.has(symbol)) return { symbol, found: false };
      const seed = SEED_BY_SYMBOL.get(symbol);
      if (!seed) return { symbol, found: false };
      return { symbol, found: true, quote: buildQuote(seed, options?.scenario) };
    });
  }

  async getHistory(symbol: string): Promise<HistoryResult> {
    return getHistory(symbol);
  }
}

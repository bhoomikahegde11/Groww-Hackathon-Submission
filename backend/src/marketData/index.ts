import { MockMarketDataProvider } from "./mockProvider";
import type { MarketDataProvider } from "./types";

// Swap this for a real implementation (e.g. a broker/exchange API client)
// when one is available — nothing else in the backend needs to change,
// since callers only depend on the MarketDataProvider interface.
export const marketDataProvider: MarketDataProvider = new MockMarketDataProvider();

export type {
  HistoryPoint,
  HistoryResult,
  MarketDataProvider,
  MarketDataQueryOptions,
  Quote,
  QuoteResult,
} from "./types";

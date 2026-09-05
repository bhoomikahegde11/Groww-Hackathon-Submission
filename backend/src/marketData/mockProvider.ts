import { createRng } from "./rng";
import { SCENARIOS, type Scenario } from "./scenarios";
import { STOCK_SEEDS, type StockSeed } from "./seedStocks";
import type {
  MarketDataProvider,
  MarketDataQueryOptions,
  Quote,
  QuoteResult,
} from "./types";

const SEED_BY_SYMBOL = new Map(STOCK_SEEDS.map((seed) => [seed.symbol, seed]));

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildQuote(seed: StockSeed, scenarioOverride?: Scenario): Quote {
  const rng = createRng(seed.symbol);
  const scenario = scenarioOverride ?? seed.scenario;
  const profile = SCENARIOS[scenario];

  const [minChange, maxChange] = profile.changeRange;
  const changePct = minChange + rng() * (maxChange - minChange);
  let lastPrice = seed.previousClose * (1 + changePct);

  const openDrift = (rng() - 0.5) * 0.01; // open within +/-0.5% of previous close
  const open = seed.previousClose * (1 + openDrift);

  const highPad = 0.002 + rng() * 0.01;
  const lowPad = 0.002 + rng() * 0.01;
  let dayHigh = Math.max(lastPrice, open) * (1 + highPad);
  let dayLow = Math.min(lastPrice, open) * (1 - lowPad);

  let weekHigh52 = seed.weekHigh52;
  let weekLow52 = seed.weekLow52;

  if (profile.forceWeekBoundary === "high") {
    lastPrice = weekHigh52 * (1 + 0.005 + rng() * 0.01);
  } else if (profile.forceWeekBoundary === "low") {
    lastPrice = weekLow52 * (1 - (0.005 + rng() * 0.01));
  }

  // Enforce field invariants regardless of how the scenario math landed:
  // day high/low and 52-week high/low must always bracket the last price.
  dayHigh = Math.max(dayHigh, lastPrice, open);
  dayLow = Math.min(dayLow, lastPrice, open);
  weekHigh52 = Math.max(weekHigh52, lastPrice, dayHigh);
  weekLow52 = Math.min(weekLow52, lastPrice, dayLow);

  const [minVolMult, maxVolMult] = profile.volumeMultiplier;
  const volume = Math.round(
    seed.avgVolume * (minVolMult + rng() * (maxVolMult - minVolMult)),
  );

  return {
    symbol: seed.symbol,
    name: seed.name,
    lastPrice: round2(lastPrice),
    previousClose: round2(seed.previousClose),
    open: round2(open),
    dayHigh: round2(dayHigh),
    dayLow: round2(dayLow),
    volume,
    weekHigh52: round2(weekHigh52),
    weekLow52: round2(weekLow52),
    asOf: new Date().toISOString(),
  };
}

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
}

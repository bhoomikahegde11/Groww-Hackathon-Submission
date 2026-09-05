import assert from "node:assert/strict";
import test from "node:test";
import { detectItemChange, THRESHOLDS } from "./changeDetection";
import { MockMarketDataProvider } from "./mockProvider";

function changePercent(previousClose: number, lastPrice: number): number {
  return ((lastPrice - previousClose) / previousClose) * 100;
}

test("no scenario override uses the symbol's own default (normal) behavior", async () => {
  const provider = new MockMarketDataProvider();
  const [result] = await provider.getQuotes(["TCS"]);

  assert.ok(result.found);
  if (!result.found) return;

  const pct = changePercent(result.quote.previousClose, result.quote.lastPrice);
  // "normal" scenario range is +/-1.5% — well under the meaningful-change threshold.
  assert.ok(Math.abs(pct) < THRESHOLDS.significantPriceMovePct);
});

test("scenario=significant-move crosses the meaningful price-change threshold", async () => {
  const provider = new MockMarketDataProvider();
  const [result] = await provider.getQuotes(["TCS"], {
    scenario: "significant-move",
  });

  assert.ok(result.found);
  if (!result.found) return;

  const pct = changePercent(result.quote.previousClose, result.quote.lastPrice);
  assert.ok(Math.abs(pct) >= THRESHOLDS.significantPriceMovePct);

  // The override doesn't just change the number — it should actually be
  // flagged as meaningful by the existing detection rules.
  const change = detectItemChange({
    symbol: "TCS",
    name: "Tata Consultancy Services",
    previous: {
      price: result.quote.previousClose,
      volume: result.quote.volume,
      weekHigh52: result.quote.weekHigh52,
      weekLow52: result.quote.weekLow52,
    },
    current: {
      price: result.quote.lastPrice,
      volume: result.quote.volume,
      weekHigh52: result.quote.weekHigh52,
      weekLow52: result.quote.weekLow52,
    },
  });
  assert.ok(change);
  assert.ok(change?.flags.some((f) => f.type === "significant-price-move"));
});

test("the same scenario override is deterministic across repeated calls", async () => {
  const provider = new MockMarketDataProvider();
  const [first] = await provider.getQuotes(["INFY"], {
    scenario: "high-volume",
  });
  const [second] = await provider.getQuotes(["INFY"], {
    scenario: "high-volume",
  });

  assert.ok(first.found && second.found);
  if (!first.found || !second.found) return;
  assert.equal(first.quote.lastPrice, second.quote.lastPrice);
  assert.equal(first.quote.volume, second.quote.volume);
});

test("52w-high-cross override pushes the price to/above the 52-week high", async () => {
  const provider = new MockMarketDataProvider();
  const [result] = await provider.getQuotes(["RELIANCE"], {
    scenario: "52w-high-cross",
  });

  assert.ok(result.found);
  if (!result.found) return;
  assert.ok(result.quote.lastPrice >= result.quote.weekHigh52 * 0.999);
});

test("an unsupported symbol is still reported as not found regardless of scenario", async () => {
  const provider = new MockMarketDataProvider();
  const [result] = await provider.getQuotes(["NOT_A_SYMBOL"], {
    scenario: "significant-move",
  });
  assert.equal(result.found, false);
});

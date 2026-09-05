import assert from "node:assert/strict";
import test from "node:test";
import {
  detectItemChange,
  detectWatchlistChanges,
  type ItemComparisonInput,
} from "./changeDetection";

const baseline = {
  price: 1000,
  volume: 1_000_000,
  weekHigh52: 1200,
  weekLow52: 800,
};

function input(overrides: Partial<ItemComparisonInput> = {}): ItemComparisonInput {
  return {
    symbol: "TEST",
    name: "Test Co",
    previous: { ...baseline },
    current: { ...baseline },
    ...overrides,
  };
}

test("no previous snapshot returns no change", () => {
  const result = detectItemChange(input({ previous: null }));
  assert.equal(result, null);
});

test("missing current market data returns no change", () => {
  const result = detectItemChange(input({ current: null }));
  assert.equal(result, null);
});

test("insignificant price movement is not flagged", () => {
  const result = detectItemChange(
    input({ current: { ...baseline, price: 1010 } }), // +1%
  );
  assert.equal(result, null);
});

test("significant price movement is flagged", () => {
  const result = detectItemChange(
    input({ current: { ...baseline, price: 950 } }), // -5%
  );
  assert.ok(result);
  assert.equal(result?.changePercent, -5);
  assert.ok(result?.flags.some((f) => f.type === "significant-price-move"));
});

test("new 52-week high is flagged", () => {
  const result = detectItemChange(
    input({ current: { ...baseline, price: 1010, weekHigh52: 1250 } }),
  );
  assert.ok(result);
  assert.ok(result?.flags.some((f) => f.type === "new-52w-high"));
});

test("new 52-week low is flagged", () => {
  const result = detectItemChange(
    input({ current: { ...baseline, price: 990, weekLow52: 750 } }),
  );
  assert.ok(result);
  assert.ok(result?.flags.some((f) => f.type === "new-52w-low"));
});

test("unusually high volume is flagged", () => {
  const result = detectItemChange(
    input({ current: { ...baseline, volume: 2_500_000 } }), // 2.5x
  );
  assert.ok(result);
  assert.ok(result?.flags.some((f) => f.type === "unusual-volume"));
});

test("volume exactly at the threshold multiplier is flagged", () => {
  const result = detectItemChange(
    input({ current: { ...baseline, volume: 2_000_000 } }), // exactly 2x
  );
  assert.ok(result);
  assert.ok(result?.flags.some((f) => f.type === "unusual-volume"));
});

test("multiple changes on the same stock are all reported", () => {
  const result = detectItemChange(
    input({
      current: {
        price: 1100, // +10%
        volume: 3_000_000, // 3x
        weekHigh52: 1300, // new high
        weekLow52: 800,
      },
    }),
  );
  assert.ok(result);
  const types = result?.flags.map((f) => f.type).sort();
  assert.deepEqual(types, [
    "new-52w-high",
    "significant-price-move",
    "unusual-volume",
  ]);
});

test("detectWatchlistChanges reports multiple stocks and orders by largest move", () => {
  const inputs: ItemComparisonInput[] = [
    input({ symbol: "SMALL_MOVE", current: { ...baseline, price: 1040 } }), // +4%, flagged
    input({ symbol: "NO_MOVE", current: { ...baseline, price: 1005 } }), // +0.5%, not flagged
    input({ symbol: "BIG_MOVE", current: { ...baseline, price: 800 } }), // -20%, flagged
  ];

  const changes = detectWatchlistChanges(inputs);
  assert.equal(changes.length, 2);
  assert.equal(changes[0].symbol, "BIG_MOVE");
  assert.equal(changes[1].symbol, "SMALL_MOVE");
});

test("missing/unsupported market data for one stock does not affect others", () => {
  const inputs: ItemComparisonInput[] = [
    input({ symbol: "UNSUPPORTED", current: null }),
    input({ symbol: "MOVER", current: { ...baseline, price: 1200 } }),
  ];

  const changes = detectWatchlistChanges(inputs);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].symbol, "MOVER");
});

import assert from "node:assert/strict";
import test from "node:test";
import { rankChangesByAttention, scoreChange } from "./attentionScoring";
import type { ItemChangeSummary } from "./changeDetection";

const baseline = {
  price: 1000,
  volume: 1_000_000,
  weekHigh52: 1200,
  weekLow52: 800,
};

function change(overrides: Partial<ItemChangeSummary> = {}): ItemChangeSummary {
  return {
    symbol: "TEST",
    name: "Test Co",
    previous: { ...baseline },
    current: { ...baseline },
    changePercent: 0,
    flags: [],
    ...overrides,
  };
}

test("3% price movement scores +2", () => {
  const score = scoreChange(change({ changePercent: 3 }));
  assert.equal(score, 2);
});

test("just under 5% price movement still scores +2", () => {
  const score = scoreChange(change({ changePercent: 4.99 }));
  assert.equal(score, 2);
});

test("5% price movement scores +3", () => {
  const score = scoreChange(change({ changePercent: 5 }));
  assert.equal(score, 3);
});

test("just under 10% price movement still scores +3", () => {
  const score = scoreChange(change({ changePercent: -9.99 }));
  assert.equal(score, 3);
});

test("10%+ price movement scores +4", () => {
  const score = scoreChange(change({ changePercent: -12 }));
  assert.equal(score, 4);
});

test("price movement under 3% contributes no price score", () => {
  const score = scoreChange(change({ changePercent: 1.5 }));
  assert.equal(score, 0);
});

test("volume ratio just under 2x contributes no volume score", () => {
  const score = scoreChange(
    change({
      current: { ...baseline, volume: 1_999_999 },
    }),
  );
  assert.equal(score, 0);
});

test("volume ratio at the 2x boundary scores +2", () => {
  const score = scoreChange(
    change({
      current: { ...baseline, volume: 2_000_000 },
    }),
  );
  assert.equal(score, 2);
});

test("volume ratio just under 3x still scores +2", () => {
  const score = scoreChange(
    change({
      current: { ...baseline, volume: 2_999_999 },
    }),
  );
  assert.equal(score, 2);
});

test("volume ratio at the 3x boundary scores +3", () => {
  const score = scoreChange(
    change({
      current: { ...baseline, volume: 3_000_000 },
    }),
  );
  assert.equal(score, 3);
});

test("new 52-week high scores +2", () => {
  const score = scoreChange(
    change({
      current: { ...baseline, weekHigh52: 1250 },
    }),
  );
  assert.equal(score, 2);
});

test("new 52-week low scores +2", () => {
  const score = scoreChange(
    change({
      current: { ...baseline, weekLow52: 750 },
    }),
  );
  assert.equal(score, 2);
});

test("multiple simultaneous signals accumulate additively with no bonus", () => {
  // +4 (12% move) + 3 (3x volume) + 2 (new high) = 9, nothing extra.
  const score = scoreChange(
    change({
      changePercent: 12,
      current: {
        price: 1120,
        volume: 3_000_000,
        weekHigh52: 1300,
        weekLow52: 800,
      },
    }),
  );
  assert.equal(score, 9);
});

test("all four signal categories at once accumulate correctly", () => {
  // +4 (price) + 3 (volume) + 2 (high) + 2 (low) = 11
  const score = scoreChange(
    change({
      changePercent: -15,
      current: {
        price: 850,
        volume: 5_000_000,
        weekHigh52: 1300,
        weekLow52: 700,
      },
    }),
  );
  assert.equal(score, 11);
});

test("rankChangesByAttention orders by score descending", () => {
  const low = change({ symbol: "LOW", changePercent: 3 }); // score 2
  const high = change({ symbol: "HIGH", changePercent: 12 }); // score 4
  const mid = change({ symbol: "MID", changePercent: 6 }); // score 3

  const ranked = rankChangesByAttention([low, high, mid]);
  assert.deepEqual(
    ranked.map((r) => r.change.symbol),
    ["HIGH", "MID", "LOW"],
  );
  assert.deepEqual(
    ranked.map((r) => r.score),
    [4, 3, 2],
  );
});

test("tie-breaking uses largest absolute price movement, then symbol alphabetically", () => {
  // Both score +2 (3%-4.99% band), same tier.
  const a = change({ symbol: "BBB", changePercent: 4 });
  const b = change({ symbol: "AAA", changePercent: 4 });
  // Equal score AND equal abs% -> falls through to symbol tie-break.
  const rankedEqual = rankChangesByAttention([a, b]);
  assert.deepEqual(
    rankedEqual.map((r) => r.change.symbol),
    ["AAA", "BBB"],
  );

  // Same score tier (+2 each) but different abs% within the tier -> larger wins.
  const bigger = change({ symbol: "ZZZ", changePercent: 4.9 });
  const smaller = change({ symbol: "AAA", changePercent: 3.1 });
  const rankedByMove = rankChangesByAttention([smaller, bigger]);
  assert.deepEqual(
    rankedByMove.map((r) => r.change.symbol),
    ["ZZZ", "AAA"],
  );
});

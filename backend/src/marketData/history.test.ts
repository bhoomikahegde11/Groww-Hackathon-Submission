import assert from "node:assert/strict";
import test from "node:test";
import { getHistory } from "./history";
import { buildQuote } from "./quoteMath";
import { STOCK_SEEDS } from "./seedStocks";

const TCS_SEED = STOCK_SEEDS.find((s) => s.symbol === "TCS")!;

test("returns approximately 30 daily points for a known symbol", () => {
  const result = getHistory("TCS");
  assert.equal(result.found, true);
  if (!result.found) return;
  assert.equal(result.points.length, 30);
});

test("history is deterministic across repeated calls", () => {
  const first = getHistory("TCS");
  const second = getHistory("TCS");
  assert.deepEqual(first, second);
});

test("the latest historical point matches today's simulated quote price", () => {
  const result = getHistory("TCS");
  assert.equal(result.found, true);
  if (!result.found) return;

  const quote = buildQuote(TCS_SEED);
  const latest = result.points[result.points.length - 1];
  assert.equal(latest.close, quote.lastPrice);
});

test("the latest point's date is today (UTC)", () => {
  const result = getHistory("TCS");
  assert.equal(result.found, true);
  if (!result.found) return;

  const latest = result.points[result.points.length - 1];
  const todayIso = new Date().toISOString().slice(0, 10);
  assert.equal(latest.date, todayIso);
});

test("dates are strictly increasing, oldest to newest, one day apart", () => {
  const result = getHistory("INFY");
  assert.equal(result.found, true);
  if (!result.found) return;

  for (let i = 1; i < result.points.length; i++) {
    const prev = new Date(result.points[i - 1].date).getTime();
    const curr = new Date(result.points[i].date).getTime();
    assert.equal(curr - prev, 24 * 60 * 60 * 1000);
  }
});

test("every close is a positive, finite number", () => {
  const result = getHistory("RELIANCE");
  assert.equal(result.found, true);
  if (!result.found) return;

  for (const point of result.points) {
    assert.ok(Number.isFinite(point.close));
    assert.ok(point.close > 0);
  }
});

test("different symbols produce different histories", () => {
  const tcs = getHistory("TCS");
  const infy = getHistory("INFY");
  assert.equal(tcs.found, true);
  assert.equal(infy.found, true);
  if (!tcs.found || !infy.found) return;
  assert.notDeepEqual(tcs.points, infy.points);
});

test("an unknown symbol returns found:false rather than throwing", () => {
  const result = getHistory("NOT_A_REAL_SYMBOL");
  assert.equal(result.found, false);
});

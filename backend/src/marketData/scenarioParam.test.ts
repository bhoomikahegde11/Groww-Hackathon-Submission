import assert from "node:assert/strict";
import test from "node:test";
import { parseScenarioParam } from "./scenarioParam";

test("no scenario param returns ok with scenario undefined (preserves default)", () => {
  const result = parseScenarioParam(undefined);
  assert.deepEqual(result, { ok: true, scenario: undefined });
});

test("a known scenario name is accepted", () => {
  const result = parseScenarioParam("significant-move");
  assert.deepEqual(result, { ok: true, scenario: "significant-move" });
});

for (const scenario of [
  "normal",
  "significant-move",
  "high-volume",
  "52w-high-cross",
  "52w-low-cross",
]) {
  test(`"${scenario}" is a valid scenario`, () => {
    const result = parseScenarioParam(scenario);
    assert.equal(result.ok, true);
  });
}

test("an invalid scenario name is rejected with a clear error", () => {
  const result = parseScenarioParam("not-a-real-scenario");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /Invalid scenario/);
    assert.match(result.error, /significant-move/);
  }
});

test("a non-string value (e.g. repeated query param) is rejected", () => {
  const result = parseScenarioParam(["normal", "high-volume"]);
  assert.equal(result.ok, false);
});

test("invalid-scenario error is the exact message both /quotes and /snapshot return as 400", () => {
  // Both routes call this same validator and respond with
  // res.status(400).json({ error: parsedScenario.error }) verbatim, so
  // pinning the exact string here covers both without duplicating a
  // route-level test for each.
  const result = parseScenarioParam("bogus");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.error,
      "Invalid scenario. Supported values: normal, significant-move, high-volume, 52w-high-cross, 52w-low-cross",
    );
  }
});

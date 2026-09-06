import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "./prisma";
import { acknowledgeSnapshot, getSnapshotView } from "./snapshotService";

// These tests run against the app's real configured database, but only
// ever touch rows under a uniquely-named test user/watchlist that this
// file creates and tears down itself — they never reset, recreate, or
// otherwise disturb the app's actual data.
const TEST_USER_ID = "test-user-snapshot-scenario";
const TEST_WATCHLIST_ID = "test-watchlist-snapshot-scenario";

async function setupIsolatedWatchlist() {
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: `${TEST_USER_ID}@example.test`,
      passwordHash: "unused-in-these-tests",
      name: "Snapshot Scenario Test User",
    },
  });
  await prisma.watchlist.create({
    data: {
      id: TEST_WATCHLIST_ID,
      userId: TEST_USER_ID,
      name: "Snapshot Scenario Test Watchlist",
    },
  });
}

async function teardownIsolatedWatchlist() {
  // Cascades to WatchlistItem/WatchlistSnapshot rows for this watchlist.
  await prisma.watchlist.deleteMany({ where: { id: TEST_WATCHLIST_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
}

test("snapshot without scenario preserves existing first-visit behavior", async (t) => {
  await setupIsolatedWatchlist();
  t.after(teardownIsolatedWatchlist);

  await prisma.watchlistItem.create({
    data: { watchlistId: TEST_WATCHLIST_ID, symbol: "TCS" },
  });

  const view = await getSnapshotView(TEST_WATCHLIST_ID);
  assert.equal(view.kind, "first-visit");
});

test("snapshot with scenario=significant-move detects the price move once a baseline exists", async (t) => {
  await setupIsolatedWatchlist();
  t.after(teardownIsolatedWatchlist);

  await prisma.watchlistItem.create({
    data: {
      watchlistId: TEST_WATCHLIST_ID,
      symbol: "TCS",
      // Baseline matching TCS's normal-scenario seed values, as if the
      // user last checked before today's simulated significant move.
      lastSeenPrice: 3850,
      lastSeenVolume: 2_500_000,
      lastSeenWeekHigh52: 4260,
      lastSeenWeekLow52: 3550,
      lastSeenAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });

  const view = await getSnapshotView(TEST_WATCHLIST_ID, {
    scenario: "significant-move",
  });

  assert.equal(view.kind, "while-you-were-away");
  if (view.kind !== "while-you-were-away") return;
  assert.equal(view.changes.length, 1);
  assert.equal(view.changes[0].symbol, "TCS");
  assert.ok(Math.abs(view.changes[0].changePercent) >= 3);
});

test("snapshot with an unsupported symbol under a scenario override does not crash", async (t) => {
  await setupIsolatedWatchlist();
  t.after(teardownIsolatedWatchlist);

  await prisma.watchlistItem.create({
    data: {
      watchlistId: TEST_WATCHLIST_ID,
      symbol: "NOT_A_REAL_SYMBOL",
      lastSeenPrice: 100,
      lastSeenVolume: 1000,
      lastSeenWeekHigh52: 120,
      lastSeenWeekLow52: 80,
      lastSeenAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });

  const view = await getSnapshotView(TEST_WATCHLIST_ID, {
    scenario: "significant-move",
  });

  // No quote data available for this symbol -> no changes surfaced, no crash.
  assert.ok(view.kind === "no-changes" || view.kind === "first-visit");
});

test("a complete provider failure does not crash and does not advance an existing baseline", async (t) => {
  await setupIsolatedWatchlist();
  t.after(teardownIsolatedWatchlist);

  const baseline = {
    lastSeenPrice: 3850,
    lastSeenVolume: 2_500_000,
    lastSeenWeekHigh52: 4260,
    lastSeenWeekLow52: 3550,
    lastSeenAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  };

  await prisma.watchlistItem.create({
    data: { watchlistId: TEST_WATCHLIST_ID, symbol: "TCS", ...baseline },
  });

  const view = await getSnapshotView(TEST_WATCHLIST_ID, {
    simulateProviderFailure: true,
  });

  // No current data was obtainable for anything -> no false change, no crash.
  assert.equal(view.kind, "no-changes");

  const item = await prisma.watchlistItem.findFirst({
    where: { watchlistId: TEST_WATCHLIST_ID, symbol: "TCS" },
  });
  assert.equal(item?.lastSeenPrice, baseline.lastSeenPrice);
  assert.equal(item?.lastSeenVolume, baseline.lastSeenVolume);
  assert.equal(item?.lastSeenAt?.getTime(), baseline.lastSeenAt.getTime());
});

test("a partial quote failure still detects changes for the successful symbol and leaves the failed symbol's baseline untouched", async (t) => {
  await setupIsolatedWatchlist();
  t.after(teardownIsolatedWatchlist);

  const tcsBaseline = {
    lastSeenPrice: 3850,
    lastSeenVolume: 2_500_000,
    lastSeenWeekHigh52: 4260,
    lastSeenWeekLow52: 3550,
    lastSeenAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  };
  const infyBaseline = {
    lastSeenPrice: 1550,
    lastSeenVolume: 6_000_000,
    lastSeenWeekHigh52: 1770,
    lastSeenWeekLow52: 1350,
    lastSeenAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  };

  await prisma.watchlistItem.create({
    data: { watchlistId: TEST_WATCHLIST_ID, symbol: "TCS", ...tcsBaseline },
  });
  await prisma.watchlistItem.create({
    data: { watchlistId: TEST_WATCHLIST_ID, symbol: "INFY", ...infyBaseline },
  });

  const view = await getSnapshotView(TEST_WATCHLIST_ID, {
    scenario: "significant-move",
    failSymbols: ["INFY"],
  });

  // Only TCS (the successful symbol) is surfaced — INFY's failed quote must
  // not be treated as a change, and must not crash the whole comparison.
  assert.equal(view.kind, "while-you-were-away");
  if (view.kind !== "while-you-were-away") return;
  assert.equal(view.changes.length, 1);
  assert.equal(view.changes[0].symbol, "TCS");

  await acknowledgeSnapshot(TEST_WATCHLIST_ID);

  const tcsAfter = await prisma.watchlistItem.findFirst({
    where: { watchlistId: TEST_WATCHLIST_ID, symbol: "TCS" },
  });
  const infyAfter = await prisma.watchlistItem.findFirst({
    where: { watchlistId: TEST_WATCHLIST_ID, symbol: "INFY" },
  });

  // TCS's baseline advances to the new (real) quote values.
  assert.notEqual(tcsAfter?.lastSeenPrice, tcsBaseline.lastSeenPrice);

  // INFY's baseline is completely untouched — its quote failed, so it must
  // not be advanced using missing/invalid data.
  assert.equal(infyAfter?.lastSeenPrice, infyBaseline.lastSeenPrice);
  assert.equal(infyAfter?.lastSeenVolume, infyBaseline.lastSeenVolume);
  assert.equal(infyAfter?.lastSeenWeekHigh52, infyBaseline.lastSeenWeekHigh52);
  assert.equal(infyAfter?.lastSeenWeekLow52, infyBaseline.lastSeenWeekLow52);
  assert.equal(infyAfter?.lastSeenAt?.getTime(), infyBaseline.lastSeenAt.getTime());
});

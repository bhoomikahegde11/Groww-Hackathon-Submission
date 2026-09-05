import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "./prisma";
import { getSnapshotView } from "./snapshotService";

// These tests run against the app's real configured database, but only
// ever touch rows under a uniquely-named test user/watchlist that this
// file creates and tears down itself — they never reset, recreate, or
// otherwise disturb the app's actual data.
const TEST_USER_ID = "test-user-snapshot-scenario";
const TEST_WATCHLIST_ID = "test-watchlist-snapshot-scenario";

async function setupIsolatedWatchlist() {
  await prisma.user.create({
    data: { id: TEST_USER_ID, name: "Snapshot Scenario Test User" },
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

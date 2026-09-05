# While You Were Away

Technical reference for the app's core feature: surfacing what meaningfully
changed on a user's watchlist since their last visit. For setup, API
endpoints, and data model, see the [root README](../README.md).

## Product problem

A user returns to a watchlist after being away for some period and
shouldn't have to manually scan every stock to figure out what changed.
The app should tell them, on arrival, which of their stocks moved enough
to matter — and nothing more.

## Meaningful change detection

Implemented in `backend/src/marketData/changeDetection.ts`
(`detectItemChange`, `detectWatchlistChanges`), unit-tested in
`changeDetection.test.ts`. A symbol is flagged if any of the following are
true, compared against its last-seen baseline:

| Rule | Condition |
| --- | --- |
| Significant price movement | absolute % change ≥ 3% |
| New 52-week high | today's 52-week high > last-seen 52-week high |
| New 52-week low | today's 52-week low < last-seen 52-week low |
| Unusual volume | current volume ≥ 2x last-seen volume |

A symbol can carry multiple flags at once. Detection only decides *whether*
a change is meaningful — it has no concept of ranking or priority.

## Attention ranking

Implemented in `backend/src/marketData/attentionScoring.ts`
(`scoreChange`, `rankChangesByAttention`), unit-tested in
`attentionScoring.test.ts`. Kept as a separate module from detection: this
layer only decides *how much attention* an already-detected change deserves.

Score is additive across independent bands — a change earns points from
each category it qualifies for, with **no bonus for triggering multiple
signals** (the score is just the sum, nothing extra):

| Signal | Band | Points |
| --- | --- | --- |
| Price move | 3% – <5% | +2 |
| Price move | 5% – <10% | +3 |
| Price move | ≥10% | +4 |
| Volume ratio | 2x – <3x | +2 |
| Volume ratio | ≥3x | +3 |
| New 52-week high | — | +2 |
| New 52-week low | — | +2 |

Changes are sorted descending by score. Ties break, in order: largest
absolute price movement, then symbol alphabetically — so ordering is fully
deterministic for a given market state.

The score itself is never exposed to the frontend or the API response
(`PublicChange` has no score field) — it's purely an internal ranking
mechanism, not user-facing data.

## Last-seen lifecycle

Implemented in `backend/src/lib/snapshotService.ts`. Each `WatchlistItem`
carries `lastSeen*` fields (price, volume, 52-week high/low, timestamp) —
the baseline for comparison. At most one `WatchlistSnapshot` row exists per
watchlist (not a history log).

1. **First visit** — an item with no baseline silently starts tracking
   from the current quote. No banner is shown; there's nothing to compare
   against yet.
2. **Meaningful change → pending snapshot** — on a later visit, if
   comparing current quotes to the baseline produces any flagged changes,
   a `WatchlistSnapshot` is created (or replaced, if the previous one was
   already acknowledged) holding the ranked changes and the exact
   current-quote values, `acknowledged: false`.
3. **Stability until acknowledged** — while a snapshot is pending, repeated
   `GET /api/market/snapshot` calls return the *same* comparison rather
   than recomputing it. This prevents a refresh from fabricating a new
   "while you were away" event before the user has acted on the current one.
4. **Acknowledgement advances the baseline** — `POST /api/market/snapshot/ack`
   is idempotent and, in one transaction, copies the values *captured when
   the snapshot was created* into each item's `lastSeen*` fields (not
   freshly re-fetched quotes), then marks the snapshot acknowledged. Using
   the frozen values — rather than re-querying the market data provider —
   means a duplicate acknowledgement (e.g. a manual click racing the
   frontend's automatic viewport-based acknowledgement) can't advance the
   baseline to inconsistent data.
5. **After acknowledgement** — the next visit compares against the new
   baseline. If nothing meaningful changed, the last acknowledged
   comparison is still shown in a compact "since last visit" form until a
   new meaningful change replaces it.

## Data strategy

Market data is served through a `MarketDataProvider` interface
(`backend/src/marketData/types.ts`); every consumer (routes, snapshot
service) depends on that interface, not on any concrete implementation.
The only implementation today is `MockMarketDataProvider` — deterministic
simulated quotes derived from fixed seed data and a scenario profile via a
seeded PRNG, so a given symbol always produces the same simulated quote
rather than a new random value per request.

**Why simulated data for this hackathon:** a real market-data API would add
integration cost, latency, cost-per-call, and time-of-day dependence that
aren't the point of this exercise — the goal is to demonstrate the change
detection, scoring, and snapshot lifecycle, which all require a
*predictable, repeatable* market state to build and test against.
Determinism was a requirement, not just a convenience: a source that
changes non-deterministically on every request would make it impossible to
reliably demo or test "while you were away" behavior. The provider
abstraction means a real data source can later replace
`MockMarketDataProvider` (a new class implementing the same interface)
without changing detection, scoring, persistence, or the frontend.

## Architecture flow

```
Market Data Provider  →  Change Detection  →  Attention Scoring  →  Snapshot Persistence  →  While You Were Away UI
 (MarketDataProvider)     (changeDetection)     (attentionScoring)    (snapshotService,          (WhileYouWereAway.tsx)
                                                                       WatchlistSnapshot)
```

Each stage depends only on the interface/output of the one before it:

- **Market Data Provider** returns quotes for a set of symbols (`Quote` /
  `QuoteResult`), with no knowledge of watchlists, baselines, or scoring.
- **Change Detection** compares a baseline to a current quote and returns
  flagged changes, with no knowledge of scoring or persistence.
- **Attention Scoring** ranks already-detected changes, with no knowledge
  of where they came from or where they're going.
- **Snapshot Persistence** orchestrates the above against the database
  (baselines, the pending/acknowledged snapshot row) and exposes the
  `GET /api/market/snapshot` / `POST /api/market/snapshot/ack` API.
- **While You Were Away UI** renders whatever the API returns and drives
  acknowledgement (button click or viewport-based auto-acknowledge) — it
  has no detection or scoring logic of its own.

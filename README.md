# Smart Market Watchlist

A watchlist app where users track stocks and, when they return, understand what has meaningfully changed since their last visit.

Built for the Groww CODE 2026 hackathon.

## Status

Core loop works end-to-end: add/view/remove stock symbols on a persistent watchlist, each shown with simulated market data, plus a "while you were away" summary of meaningful changes since the user's last visit. There's still no authentication — everything operates on a single placeholder user. A real market-data integration is not implemented yet — that's next.

## Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + TypeScript + Express
- **Database:** SQLite via Prisma

## Project structure

```
backend/    Express API + Prisma schema/migrations
frontend/   Vite + React app
```

## Setup

Requires Node.js 20+.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:migrate   # creates dev.db and applies migrations
npm run dev               # starts API on http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev               # starts app on http://localhost:5173
```

With both running, open http://localhost:5173 to add, view, and remove watchlist symbols. Changes persist in SQLite across page refreshes and server restarts.

## Backend scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API with hot reload |
| `npm run build` / `npm start` | Compile and run the production build |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run change-detection unit tests |
| `npm run prisma:migrate` | Apply Prisma migrations to the local SQLite DB |
| `npm run prisma:studio` | Open Prisma Studio to browse data |

## Environment variables

**backend/.env**
- `PORT` — API port (default `4000`)
- `DATABASE_URL` — SQLite connection string (default `file:./dev.db`)

**frontend/.env**
- `VITE_API_BASE_URL` — backend base URL (default `http://localhost:4000`)

## Data model

- `User` — placeholder owner of watchlists (no auth yet)
- `Watchlist` — a named list belonging to a user
- `WatchlistItem` — a stock symbol on a watchlist (unique per watchlist), plus its `lastSeen*` fields (price, volume, 52-week high/low, timestamp) — the baseline used to detect what changed since the user's last visit
- `WatchlistSnapshot` — at most one per watchlist: the most recently detected set of changes and whether the user has acknowledged it (not a historical log — overwritten on each new comparison)

## API

- `GET /api/health` — backend and database connectivity status
- `GET /api/watchlist` — the placeholder user's watchlist and its items
- `POST /api/watchlist/items` — add a symbol, body `{ "symbol": "AAPL" }`
  - `400` invalid symbol, `409` symbol already on the watchlist
- `DELETE /api/watchlist/items/:symbol` — remove a symbol
  - `404` if the symbol isn't on the watchlist
- `GET /api/market/quotes` — simulated market data for the watchlist's symbols (see below)
- `GET /api/market/snapshot` — the "while you were away" comparison (see below)
- `POST /api/market/snapshot/ack` — acknowledge the current pending snapshot

Symbols are normalized to uppercase and must match `1-10` characters: letters, digits, `.` or `-`, starting with a letter.

## Market data

Backend market data is served through a `MarketDataProvider` interface (`backend/src/marketData/types.ts`), so the rest of the app depends on that contract rather than a specific data source. The only implementation right now is `MockMarketDataProvider` — no external API, no cost.

Quotes are **deterministic**: each symbol's price/volume are derived from fixed seed data (`seedStocks.ts`) plus a scenario profile (`scenarios.ts`, e.g. `normal`, `significant-move`, `high-volume`, `52w-high-cross`) using a seeded PRNG (`rng.ts`) keyed by the symbol. Same symbol -> same simulated quote every time, not a new random value per request. Swapping in a real provider later means writing one class that implements `MarketDataProvider` and pointing `marketData/index.ts` at it.

Seeded symbols: `TCS`, `INFY`, `RELIANCE`, `HDFCBANK`, `ICICIBANK`. Any other symbol on the watchlist is accepted but returns `"found": false` in the quotes response instead of erroring.

The frontend clearly labels this data as simulated.

## "While you were away"

`backend/src/marketData/changeDetection.ts` holds the pure, unit-tested rules for what counts as a "meaningful" change (see `backend/src/marketData/changeDetection.test.ts`), kept separate from routes/persistence so the rules can be tuned independently:

- price moved ≥3% since the user's last-seen price ("significant price movement")
- today's 52-week high/low exceeds what was last seen ("new 52-week high/low")
- volume is ≥2x the last-seen volume ("unusual volume")

`backend/src/lib/snapshotService.ts` orchestrates persistence: `GET /api/market/snapshot` returns one of `first-visit` (no baseline yet — a new item silently starts tracking from now, without showing a banner), `no-changes`, `while-you-were-away` (a pending, unacknowledged comparison — stable across repeated calls until acknowledged, so refreshing never fabricates a new event), or `since-last-visit` (a compact readout of the last comparison that *was* acknowledged). `POST /api/market/snapshot/ack` is idempotent and, in a single transaction, advances every item's baseline to the exact values captured when the snapshot was created (not freshly re-fetched quotes), so a duplicate acknowledgement (e.g. the "Got it" click racing the automatic viewport acknowledgement) can't corrupt the baseline.

On the frontend, the banner acknowledges either via its "Got it" button or automatically once `IntersectionObserver` reports it's been in view for ~1.5s — whichever comes first. Closing the tab before that window elapses leaves the snapshot pending, so it's shown again next visit.

Changes are additionally ranked by an explainable attention score (price move %, volume ratio, 52-week boundary crossings) before display — see [docs/while-you-were-away.md](docs/while-you-were-away.md) for the full product problem statement, detection/scoring rules, lifecycle, and architecture flow.

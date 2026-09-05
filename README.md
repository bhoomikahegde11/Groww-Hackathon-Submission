# Smart Market Watchlist

A watchlist app where users track stocks and, when they return, understand what has meaningfully changed since their last visit.

Built for the Groww CODE 2026 hackathon.

## Status

Core loop works end-to-end: add/view/remove stock symbols on a persistent watchlist (frontend → API → SQLite → API → frontend). There's still no authentication — everything operates on a single placeholder user. Market data integration and change-detection logic are not implemented yet — that's next.

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
- `WatchlistItem` — a stock symbol on a watchlist (unique per watchlist)

## API

- `GET /api/health` — backend and database connectivity status
- `GET /api/watchlist` — the placeholder user's watchlist and its items
- `POST /api/watchlist/items` — add a symbol, body `{ "symbol": "AAPL" }`
  - `400` invalid symbol, `409` symbol already on the watchlist
- `DELETE /api/watchlist/items/:symbol` — remove a symbol
  - `404` if the symbol isn't on the watchlist

Symbols are normalized to uppercase and must match `1-10` characters: letters, digits, `.` or `-`, starting with a letter.

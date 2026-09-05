# Smart Market Watchlist

A watchlist app where users track stocks and, when they return, understand what has meaningfully changed since their last visit.

Built for the Groww CODE 2026 hackathon.

## Status

This is the project foundation: frontend/backend scaffolding, database schema, and a health check wiring the two together. Market data integration and change-detection logic are not implemented yet — that's next.

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

With both running, the frontend home page shows a live backend/database health check.

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
- `WatchlistItem` — a stock symbol on a watchlist

## Health check

`GET /api/health` — returns backend and database connectivity status.

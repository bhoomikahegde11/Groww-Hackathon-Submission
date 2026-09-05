-- AlterTable
ALTER TABLE "WatchlistItem" ADD COLUMN "lastSeenAt" DATETIME;
ALTER TABLE "WatchlistItem" ADD COLUMN "lastSeenPrice" REAL;
ALTER TABLE "WatchlistItem" ADD COLUMN "lastSeenVolume" INTEGER;
ALTER TABLE "WatchlistItem" ADD COLUMN "lastSeenWeekHigh52" REAL;
ALTER TABLE "WatchlistItem" ADD COLUMN "lastSeenWeekLow52" REAL;

-- CreateTable
CREATE TABLE "WatchlistSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "watchlistId" TEXT NOT NULL,
    "comparedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" DATETIME,
    CONSTRAINT "WatchlistSnapshot_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistSnapshot_watchlistId_key" ON "WatchlistSnapshot"("watchlistId");

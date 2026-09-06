-- AddUserAuth
-- Adds email + passwordHash to User for real authentication, and makes
-- the pre-auth `name` column optional (email/password signup doesn't
-- collect a name). The single pre-existing "default-user" row (created
-- before authentication existed) is backfilled with a placeholder,
-- unguessable email and a real bcrypt hash of a random, discarded
-- password, so it keeps its id (preserving its Watchlist/WatchlistItem/
-- WatchlistSnapshot data) but can never be logged into through the app.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_User" ("id", "email", "passwordHash", "name", "createdAt")
SELECT
    "id",
    "id" || '@legacy-demo-user.invalid',
    '$2b$10$8OXPi0IxvFbUVXW1gmVuM.a4E6Ms6JSOCaKmKyMplcPFyCy1Njzge',
    "name",
    "createdAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

PRAGMA foreign_keys=ON;

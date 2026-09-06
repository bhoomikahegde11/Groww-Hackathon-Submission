import { prisma } from "./prisma";

/** Returns the given user's watchlist, creating one on first use. */
export async function getOrCreateWatchlistForUser(userId: string) {
  const existing = await prisma.watchlist.findFirst({ where: { userId } });
  if (existing) return existing;

  return prisma.watchlist.create({
    data: { userId, name: "My Watchlist" },
  });
}

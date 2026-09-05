import { prisma } from "./prisma";

const DEFAULT_USER_ID = "default-user";

// No auth yet: every request operates on this one placeholder user/watchlist.
export async function getDefaultWatchlist() {
  const user = await prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {},
    create: { id: DEFAULT_USER_ID, name: "Default User" },
  });

  const existing = await prisma.watchlist.findFirst({
    where: { userId: user.id },
  });
  if (existing) return existing;

  return prisma.watchlist.create({
    data: { userId: user.id, name: "My Watchlist" },
  });
}

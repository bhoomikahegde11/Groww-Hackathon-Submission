const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export type WatchlistItem = {
  id: string
  symbol: string
  addedAt: string
}

export type Watchlist = {
  id: string
  name: string
  items: WatchlistItem[]
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.error === 'string') return body.error
  } catch {
    // response had no JSON body
  }
  return `Request failed (${res.status})`
}

export async function fetchWatchlist(): Promise<Watchlist> {
  const res = await fetch(`${API_BASE_URL}/api/watchlist`)
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return res.json()
}

export async function addWatchlistItem(symbol: string): Promise<WatchlistItem> {
  const res = await fetch(`${API_BASE_URL}/api/watchlist/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return res.json()
}

export async function removeWatchlistItem(symbol: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/watchlist/items/${encodeURIComponent(symbol)}`,
    { method: 'DELETE' },
  )
  if (!res.ok && res.status !== 204) throw new Error(await parseErrorMessage(res))
}

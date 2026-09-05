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

export type Quote = {
  symbol: string
  name: string
  lastPrice: number
  previousClose: number
  open: number
  dayHigh: number
  dayLow: number
  volume: number
  weekHigh52: number
  weekLow52: number
  asOf: string
}

export type QuoteResult =
  | { symbol: string; found: true; quote: Quote }
  | { symbol: string; found: false }

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

export async function fetchQuotes(): Promise<QuoteResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/market/quotes`)
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  const body = await res.json()
  return body.quotes
}

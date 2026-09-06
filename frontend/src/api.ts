const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

// Every request needs the auth cookie sent along (and accepted back on
// signup/login), including cross-origin in local dev (frontend:5173 ->
// backend:4000).
const WITH_CREDENTIALS: RequestInit = { credentials: 'include' }

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

export type AuthUser = {
  id: string
  email: string
}

export async function signup(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    ...WITH_CREDENTIALS,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await res.json()).user
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    ...WITH_CREDENTIALS,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await res.json()).user
}

export async function logout(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    ...WITH_CREDENTIALS,
    method: 'POST',
  })
  if (!res.ok && res.status !== 204) throw new Error(await parseErrorMessage(res))
}

/** Returns the current user, or null if not authenticated (never throws for a 401). */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, WITH_CREDENTIALS)
  if (res.status === 401) return null
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await res.json()).user
}

export async function fetchWatchlist(): Promise<Watchlist> {
  const res = await fetch(`${API_BASE_URL}/api/watchlist`, WITH_CREDENTIALS)
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return res.json()
}

export async function addWatchlistItem(symbol: string): Promise<WatchlistItem> {
  const res = await fetch(`${API_BASE_URL}/api/watchlist/items`, {
    ...WITH_CREDENTIALS,
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
    { ...WITH_CREDENTIALS, method: 'DELETE' },
  )
  if (!res.ok && res.status !== 204) throw new Error(await parseErrorMessage(res))
}

export async function fetchQuotes(): Promise<QuoteResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/market/quotes`, WITH_CREDENTIALS)
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  const body = await res.json()
  return body.quotes
}

export type SnapshotChange = {
  symbol: string
  name: string
  changePercent: number
  primaryLabel: string
  labels: string[]
}

export type SnapshotView =
  | { kind: 'first-visit' }
  | { kind: 'no-changes' }
  | {
      kind: 'while-you-were-away'
      comparedAt: string
      previousCheckedAt: string | null
      changes: SnapshotChange[]
    }
  | {
      kind: 'since-last-visit'
      comparedAt: string
      changes: SnapshotChange[]
    }

export async function fetchSnapshot(): Promise<SnapshotView> {
  const res = await fetch(`${API_BASE_URL}/api/market/snapshot`, WITH_CREDENTIALS)
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return res.json()
}

export async function acknowledgeSnapshot(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/market/snapshot/ack`, {
    ...WITH_CREDENTIALS,
    method: 'POST',
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res))
}

export type ScenarioName =
  | 'normal'
  | 'significant-move'
  | 'high-volume'
  | '52w-high-cross'
  | '52w-low-cross'

export interface SnapshotPreview {
  scenario: ScenarioName
  changes: SnapshotChange[]
}

// Dev-only manual testing helper: read-only preview of the "while you were
// away" summary under a given simulator scenario. Never touches the real
// snapshot/baseline state (see backend GET /api/market/snapshot/preview).
export async function fetchSnapshotPreview(
  scenario: ScenarioName,
): Promise<SnapshotPreview> {
  const res = await fetch(
    `${API_BASE_URL}/api/market/snapshot/preview?scenario=${encodeURIComponent(scenario)}`,
    WITH_CREDENTIALS,
  )
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return res.json()
}

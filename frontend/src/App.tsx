import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'
import {
  acknowledgeSnapshot,
  addWatchlistItem,
  fetchCurrentUser,
  fetchQuotes,
  fetchSnapshot,
  fetchWatchlist,
  logout,
  removeWatchlistItem,
  type AuthUser,
  type QuoteResult,
  type SnapshotView,
  type WatchlistItem,
} from './api'
import { AuthScreen } from './AuthScreen'
import { DevScenarioPreview } from './DevScenarioPreview'
import { WhileYouWereAway } from './WhileYouWereAway'

function formatNumber(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatVolume(n: number): string {
  return n.toLocaleString('en-IN')
}

function formatAsOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

// The primary, right-aligned market data for a stock: price + change.
// Rendered in a fixed position next to the identity regardless of whether
// a quote is loading, missing, or present, so every row's right column
// stays aligned.
function PriceBlock({ result }: { result: QuoteResult | undefined }) {
  if (!result) {
    return <span className="price-pending">Loading…</span>
  }
  if (!result.found) {
    return <span className="price-pending">No data</span>
  }

  const { quote } = result
  const change = quote.lastPrice - quote.previousClose
  const changePct = (change / quote.previousClose) * 100
  const isUp = change >= 0

  return (
    <div className="price-block">
      <span className="price">₹{formatNumber(quote.lastPrice)}</span>
      <span className={isUp ? 'change up' : 'change down'}>
        {isUp ? '▲' : '▼'} {formatNumber(Math.abs(change))} (
        {isUp ? '+' : ''}
        {changePct.toFixed(2)}%)
      </span>
    </div>
  )
}

type SortOption =
  | 'default'
  | 'price-desc'
  | 'price-asc'
  | 'change-desc'
  | 'change-asc'
  | 'volume-desc'
  | 'volume-asc'
  | 'symbol-asc'

type FilterOption = 'all' | 'gainers' | 'losers' | 'unchanged'

const SORT_LABELS: Record<SortOption, string> = {
  default: 'Default order',
  'price-desc': 'Price: High to low',
  'price-asc': 'Price: Low to high',
  'change-desc': '% Change: High to low',
  'change-asc': '% Change: Low to high',
  'volume-desc': 'Volume: High to low',
  'volume-asc': 'Volume: Low to high',
  'symbol-asc': 'Symbol: A to Z',
}

const FILTER_LABELS: Record<FilterOption, string> = {
  all: 'All',
  gainers: 'Gainers',
  losers: 'Losers',
  unchanged: 'Unchanged',
}

interface DisplayItem {
  item: WatchlistItem
  index: number
  result: QuoteResult | undefined
  changePercent: number | null
}

/** null when there's no quote to compute a % change from (loading/missing symbol). */
function computeChangePercent(result: QuoteResult | undefined): number | null {
  if (!result?.found) return null
  const { quote } = result
  return ((quote.lastPrice - quote.previousClose) / quote.previousClose) * 100
}

/** The numeric value a given sort option ranks by, or null if unavailable for this row. */
function sortMetric(sort: SortOption, d: DisplayItem): number | null {
  if (!d.result?.found) return null
  switch (sort) {
    case 'price-desc':
    case 'price-asc':
      return d.result.quote.lastPrice
    case 'change-desc':
    case 'change-asc':
      return d.changePercent
    case 'volume-desc':
    case 'volume-asc':
      return d.result.quote.volume
    default:
      return null
  }
}

// Secondary market data: day range, volume, freshness — or a loading/
// unavailable message when there's no quote to show it for.
function SecondaryInfo({ result }: { result: QuoteResult | undefined }) {
  if (!result) {
    return <span className="quote-status">Loading market data…</span>
  }
  if (!result.found) {
    return <span className="quote-status">No simulated market data for this symbol.</span>
  }

  const { quote } = result
  return (
    <div className="quote-details">
      <span>Day range: ₹{formatNumber(quote.dayLow)} – ₹{formatNumber(quote.dayHigh)}</span>
      <span>Volume: {formatVolume(quote.volume)}</span>
      <span className="quote-freshness">Updated {formatAsOf(quote.asOf)}</span>
    </div>
  )
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [items, setItems] = useState<WatchlistItem[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({})
  const [snapshot, setSnapshot] = useState<SnapshotView | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [symbolInput, setSymbolInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null)

  const [sortOption, setSortOption] = useState<SortOption>('default')
  const [filterOption, setFilterOption] = useState<FilterOption>('all')

  const visibleItems = useMemo<DisplayItem[]>(() => {
    const decorated: DisplayItem[] = items.map((item, index) => {
      const result = quotes[item.symbol]
      return { item, index, result, changePercent: computeChangePercent(result) }
    })

    const filtered = decorated.filter((d) => {
      switch (filterOption) {
        case 'gainers':
          return d.changePercent !== null && d.changePercent > 0
        case 'losers':
          return d.changePercent !== null && d.changePercent < 0
        case 'unchanged':
          return d.changePercent !== null && d.changePercent === 0
        case 'all':
        default:
          return true
      }
    })

    // Default preserves the watchlist's own order exactly — no rearranging.
    if (sortOption === 'default') {
      return [...filtered].sort((a, b) => a.index - b.index)
    }

    // Symbol sort works for every row regardless of quote availability.
    if (sortOption === 'symbol-asc') {
      return [...filtered].sort((a, b) => a.item.symbol.localeCompare(b.item.symbol))
    }

    // Price/change/volume sorts need quote data — rows without it can't be
    // ranked, so they stay visible but sink to the bottom instead of
    // disappearing or breaking the sort.
    const rankable = filtered.filter((d) => sortMetric(sortOption, d) !== null)
    const unrankable = filtered
      .filter((d) => sortMetric(sortOption, d) === null)
      .sort((a, b) => a.index - b.index)

    const ascending = sortOption.endsWith('-asc')
    rankable.sort((a, b) => {
      const diff = (sortMetric(sortOption, a) as number) - (sortMetric(sortOption, b) as number)
      return ascending ? diff : -diff
    })

    return [...rankable, ...unrankable]
  }, [items, quotes, sortOption, filterOption])

  async function refreshQuotes() {
    try {
      const results = await fetchQuotes()
      const map: Record<string, QuoteResult> = {}
      for (const result of results) map[result.symbol] = result
      setQuotes(map)
    } catch {
      // Watchlist still works without market data; leave existing quotes as-is.
    }
  }

  async function refreshSnapshot() {
    try {
      setSnapshot(await fetchSnapshot())
    } catch {
      // The "while you were away" summary is a bonus; the watchlist works without it.
    }
  }

  async function loadWatchlistData() {
    setLoading(true)
    try {
      const watchlist = await fetchWatchlist()
      setItems(watchlist.items)
      await Promise.all([refreshQuotes(), refreshSnapshot()])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load watchlist')
    } finally {
      setLoading(false)
    }
  }

  async function handleAcknowledge() {
    try {
      await acknowledgeSnapshot()
      setFormError(null)
    } catch (err) {
      setFormError(
        err instanceof Error
          ? `Could not save that you've seen these changes: ${err.message}`
          : "Could not save that you've seen these changes.",
      )
      throw err
    } finally {
      await refreshSnapshot()
    }
  }

  useEffect(() => {
    fetchCurrentUser()
      .then(async (currentUser) => {
        setUser(currentUser)
        if (currentUser) {
          await loadWatchlistData()
        }
      })
      .catch(() => {
        // Not authenticated / backend unreachable — show the login screen.
      })
      .finally(() => setAuthChecked(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAuthenticated(authedUser: AuthUser) {
    setUser(authedUser)
    void loadWatchlistData()
  }

  async function handleLogout() {
    try {
      await logout()
    } finally {
      setUser(null)
      setItems([])
      setQuotes({})
      setSnapshot(null)
      setFormError(null)
      setSymbolInput('')
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    const symbol = symbolInput.trim()
    if (!symbol) return

    setFormError(null)
    setSubmitting(true)
    try {
      const item = await addWatchlistItem(symbol)
      setItems((prev) => [...prev, item])
      setSymbolInput('')
      await refreshQuotes()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add symbol')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(symbol: string) {
    setRemovingSymbol(symbol)
    try {
      await removeWatchlistItem(symbol)
      setItems((prev) => prev.filter((item) => item.symbol !== symbol))
      setQuotes((prev) => {
        const next = { ...prev }
        delete next[symbol]
        return next
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to remove symbol')
    } finally {
      setRemovingSymbol(null)
    }
  }

  if (!authChecked) {
    return <main className="app" />
  }

  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />
  }

  return (
    <main className="app">
      <div className="app-header">
        <div>
          <h1>Smart Market Watchlist</h1>
          <p className="disclaimer">
            Market data shown is simulated for demo purposes — not real prices.
          </p>
        </div>
        <div className="account-bar">
          <span className="account-email">{user.email}</span>
          <button type="button" className="logout-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {snapshot && (
        <WhileYouWereAway snapshot={snapshot} onAcknowledge={handleAcknowledge} />
      )}

      <form className="add-form" onSubmit={handleAdd}>
        <input
          type="text"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value)}
          placeholder="Add a symbol, e.g. TCS"
          maxLength={10}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting || !symbolInput.trim()}>
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </form>
      {formError && <p className="error">{formError}</p>}

      {loading ? (
        <p className="loading">Loading watchlist…</p>
      ) : loadError ? (
        <p className="error">Could not load watchlist: {loadError}</p>
      ) : items.length === 0 ? (
        <p className="empty">Your watchlist is empty. Add a symbol above.</p>
      ) : (
        <>
          <div className="list-controls">
            <label className="sort-control">
              Sort
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                  <option key={option} value={option}>
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <div className="filter-control" role="group" aria-label="Filter watchlist">
              {(Object.keys(FILTER_LABELS) as FilterOption[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={
                    filterOption === option ? 'filter-chip active' : 'filter-chip'
                  }
                  onClick={() => setFilterOption(option)}
                >
                  {FILTER_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <p className="empty">No stocks match this filter.</p>
          ) : (
            <ul className="watchlist">
              {visibleItems.map(({ item, result }) => {
                const name = result?.found ? result.quote.name : null
                return (
                  <li key={item.id} className="stock-row">
                    <div className="stock-row-top">
                      <div className="identity">
                        <span className="symbol">{item.symbol}</span>
                        {name && <span className="company-name">{name}</span>}
                      </div>
                      <PriceBlock result={result} />
                    </div>
                    <div className="stock-row-bottom">
                      <SecondaryInfo result={result} />
                      <button
                        type="button"
                        className="remove"
                        onClick={() => handleRemove(item.symbol)}
                        disabled={removingSymbol === item.symbol}
                      >
                        {removingSymbol === item.symbol ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {import.meta.env.DEV && <DevScenarioPreview />}
    </main>
  )
}

export default App

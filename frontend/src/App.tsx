import { useEffect, useState, type FormEvent } from 'react'
import './App.css'
import {
  acknowledgeSnapshot,
  addWatchlistItem,
  fetchQuotes,
  fetchSnapshot,
  fetchWatchlist,
  removeWatchlistItem,
  type QuoteResult,
  type SnapshotView,
  type WatchlistItem,
} from './api'
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
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({})
  const [snapshot, setSnapshot] = useState<SnapshotView | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [symbolInput, setSymbolInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null)

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
    fetchWatchlist()
      .then((watchlist) => {
        setItems(watchlist.items)
        return Promise.all([refreshQuotes(), refreshSnapshot()])
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <main className="app">
      <h1>Smart Market Watchlist</h1>
      <p className="disclaimer">
        Market data shown is simulated for demo purposes — not real prices.
      </p>

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
        <ul className="watchlist">
          {items.map((item) => {
            const result = quotes[item.symbol]
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

      {import.meta.env.DEV && <DevScenarioPreview />}
    </main>
  )
}

export default App

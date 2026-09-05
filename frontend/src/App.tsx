import { useEffect, useState, type FormEvent } from 'react'
import './App.css'
import {
  addWatchlistItem,
  fetchWatchlist,
  removeWatchlistItem,
  type WatchlistItem,
} from './api'

function App() {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [symbolInput, setSymbolInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null)

  useEffect(() => {
    fetchWatchlist()
      .then((watchlist) => setItems(watchlist.items))
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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to remove symbol')
    } finally {
      setRemovingSymbol(null)
    }
  }

  return (
    <main className="app">
      <h1>Smart Market Watchlist</h1>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          type="text"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value)}
          placeholder="Add a symbol, e.g. AAPL"
          maxLength={10}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting || !symbolInput.trim()}>
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </form>
      {formError && <p className="error">{formError}</p>}

      {loading ? (
        <p>Loading watchlist…</p>
      ) : loadError ? (
        <p className="error">Could not load watchlist: {loadError}</p>
      ) : items.length === 0 ? (
        <p className="empty">Your watchlist is empty. Add a symbol above.</p>
      ) : (
        <ul className="watchlist">
          {items.map((item) => (
            <li key={item.id}>
              <span className="symbol">{item.symbol}</span>
              <button
                type="button"
                className="remove"
                onClick={() => handleRemove(item.symbol)}
                disabled={removingSymbol === item.symbol}
              >
                {removingSymbol === item.symbol ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default App

import { useEffect, useState } from 'react'
import { fetchHistory, type HistoryPoint } from './api'

type LoadState =
  | { status: 'loading' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string }
  | { status: 'ready'; points: HistoryPoint[] }

function formatPrice(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const CHART_WIDTH = 280
const CHART_HEIGHT = 56
const CHART_PADDING = 3

function SvgLineChart({ points }: { points: HistoryPoint[] }) {
  const closes = points.map((p) => p.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const stepX = (CHART_WIDTH - CHART_PADDING * 2) / (points.length - 1)

  const coords = points
    .map((p, i) => {
      const x = CHART_PADDING + i * stepX
      const y = CHART_PADDING + (1 - (p.close - min) / range) * (CHART_HEIGHT - CHART_PADDING * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const isUp = closes[closes.length - 1] >= closes[0]

  return (
    <div className="history-chart">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="history-svg"
        role="img"
        aria-label="30-day price history"
      >
        <polyline points={coords} className={isUp ? 'history-line up' : 'history-line down'} />
      </svg>
      <div className="history-labels">
        <span>{formatDateShort(points[0].date)}</span>
        <span className="history-range">
          ₹{formatPrice(min)} – ₹{formatPrice(max)}
        </span>
        <span>{formatDateShort(points[points.length - 1].date)}</span>
      </div>
    </div>
  )
}

export function PriceHistoryChart({ symbol }: { symbol: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    fetchHistory(symbol)
      .then((result) => {
        if (cancelled) return
        setState(result.found ? { status: 'ready', points: result.points } : { status: 'unsupported' })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to load chart',
        })
      })

    return () => {
      cancelled = true
    }
  }, [symbol])

  if (state.status === 'loading') {
    return <p className="history-status">Loading chart…</p>
  }
  if (state.status === 'unsupported') {
    return <p className="history-status">No historical data for this symbol.</p>
  }
  if (state.status === 'error') {
    return <p className="history-status error">Could not load chart: {state.message}</p>
  }
  return <SvgLineChart points={state.points} />
}

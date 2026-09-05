import { useEffect, useRef } from 'react'
import type { SnapshotChange, SnapshotView } from './api'

const VIEW_TIME_TO_AUTO_ACK_MS = 1500

function formatPercent(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function formatCheckedAt(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  if (isToday) return `today at ${time}`
  const day = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  return `${day} at ${time}`
}

function ChangeCard({ change }: { change: SnapshotChange }) {
  const isUp = change.changePercent >= 0
  const showName = change.name && change.name !== change.symbol

  return (
    <li className="change-card">
      <div className="change-card-main">
        <span className="change-symbol">{change.symbol}</span>
        <span className={isUp ? 'change-pct up' : 'change-pct down'}>
          {formatPercent(change.changePercent)}
        </span>
      </div>
      {showName && <p className="change-name">{change.name}</p>}
      <div className="change-labels">
        {change.labels.map((label) => (
          <span key={label} className="change-label-pill">
            {label}
          </span>
        ))}
      </div>
    </li>
  )
}

export function WhileYouWereAway({
  snapshot,
  onAcknowledge,
  autoAcknowledge = true,
}: {
  snapshot: SnapshotView
  onAcknowledge: () => void | Promise<void>
  /** Set to false to disable the viewport-based auto-acknowledge timer (e.g. for previews/demos). Defaults to true (production behavior). */
  autoAcknowledge?: boolean
}) {
  const bannerRef = useRef<HTMLDivElement>(null)
  const acknowledgedRef = useRef(false)

  function acknowledgeOnce() {
    if (acknowledgedRef.current) return
    acknowledgedRef.current = true
    Promise.resolve(onAcknowledge()).catch(() => {
      // The request failed (e.g. a transient network error) — un-stick the
      // guard so the "Got it" button (or the next viewport intersection)
      // can retry, instead of silently becoming permanently inert.
      acknowledgedRef.current = false
    })
  }

  useEffect(() => {
    if (!autoAcknowledge) return
    if (snapshot.kind !== 'while-you-were-away') return
    const el = bannerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    let timer: ReturnType<typeof setTimeout> | null = null

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (timer === null) {
            timer = setTimeout(() => {
              acknowledgeOnce()
            }, VIEW_TIME_TO_AUTO_ACK_MS)
          }
        } else if (timer !== null) {
          clearTimeout(timer)
          timer = null
        }
      },
      { threshold: 0.6 },
    )

    observer.observe(el)

    return () => {
      if (timer !== null) clearTimeout(timer)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, autoAcknowledge])

  if (snapshot.kind === 'while-you-were-away') {
    return (
      <div className="away-banner" ref={bannerRef}>
        <div className="away-header">
          <div>
            <h2>While you were away</h2>
            <p className="away-count">
              {snapshot.changes.length} meaningful change
              {snapshot.changes.length === 1 ? '' : 's'}
            </p>
          </div>
          <button type="button" className="ack-button" onClick={acknowledgeOnce}>
            Got it
          </button>
        </div>
        <ul className="change-list">
          {snapshot.changes.map((change) => (
            <ChangeCard key={change.symbol} change={change} />
          ))}
        </ul>
        {snapshot.previousCheckedAt && (
          <p className="last-checked">
            Last checked {formatCheckedAt(snapshot.previousCheckedAt)}
          </p>
        )}
      </div>
    )
  }

  if (snapshot.kind === 'since-last-visit') {
    return (
      <div className="since-last-visit">
        <span className="since-label">Since your last visit:</span>{' '}
        <span className="since-changes">
          {snapshot.changes
            .map((c) => `${c.symbol} ${formatPercent(c.changePercent)}`)
            .join(' · ')}
        </span>
        <p className="last-checked">
          Last checked {formatCheckedAt(snapshot.comparedAt)}
        </p>
      </div>
    )
  }

  return null
}

import { useState } from 'react'
import { fetchSnapshotPreview, type ScenarioName, type SnapshotView } from './api'
import { WhileYouWereAway } from './WhileYouWereAway'

const SCENARIOS: ScenarioName[] = [
  'normal',
  'significant-move',
  'high-volume',
  '52w-high-cross',
  '52w-low-cross',
]

/**
 * Manual/dev-only testing tool: lets you preview the "While You Were Away"
 * UI under each simulator scenario for the current watchlist. Purely
 * read-only against the backend (GET /api/market/snapshot/preview) — it
 * never creates a pending snapshot, advances a baseline, or can be
 * acknowledged for real. Only rendered in `npm run dev`; excluded from
 * production builds by the `import.meta.env.DEV` check where this is used.
 */
export function DevScenarioPreview() {
  const [preview, setPreview] = useState<SnapshotView | null>(null)
  const [activeScenario, setActiveScenario] = useState<ScenarioName | null>(null)
  const [loadingScenario, setLoadingScenario] = useState<ScenarioName | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePreview(scenario: ScenarioName) {
    setError(null)
    setLoadingScenario(scenario)
    try {
      const result = await fetchSnapshotPreview(scenario)
      setActiveScenario(scenario)
      setPreview({
        kind: 'while-you-were-away',
        comparedAt: new Date().toISOString(),
        previousCheckedAt: null,
        changes: result.changes,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setLoadingScenario(null)
    }
  }

  return (
    <section className="dev-preview">
      <p className="dev-preview-label">
        Dev preview only — not visible in production. Simulates "While you
        were away" for each scenario without touching real snapshot state.
      </p>
      <div className="dev-preview-buttons">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario}
            type="button"
            onClick={() => handlePreview(scenario)}
            disabled={loadingScenario === scenario}
          >
            {loadingScenario === scenario ? 'Loading…' : scenario}
          </button>
        ))}
        {preview && (
          <button
            type="button"
            onClick={() => {
              setPreview(null)
              setActiveScenario(null)
            }}
          >
            Clear preview
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {preview && (
        <>
          <p className="dev-preview-active">Previewing: {activeScenario}</p>
          <WhileYouWereAway
            snapshot={preview}
            autoAcknowledge={false}
            onAcknowledge={() => {
              setPreview(null)
              setActiveScenario(null)
            }}
          />
        </>
      )}
    </section>
  )
}

import { useEffect, useState } from 'react'
import './App.css'

type HealthStatus = {
  status: string
  database: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setError('Could not reach backend'))
  }, [])

  return (
    <main className="app">
      <h1>Smart Market Watchlist</h1>
      <p>Foundation setup — watchlist features coming soon.</p>
      <p>
        Backend status:{' '}
        {error ? (
          <span className="status-error">{error}</span>
        ) : health ? (
          <span className="status-ok">
            {health.status} ({health.database})
          </span>
        ) : (
          'checking...'
        )}
      </p>
    </main>
  )
}

export default App

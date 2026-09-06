import { useState, type FormEvent } from 'react'
import { login, signup, type AuthUser } from './api'

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: AuthUser) => void
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user =
        mode === 'login' ? await login(email, password) : await signup(email, password)
      onAuthenticated(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="app">
      <h1>Smart Market Watchlist</h1>
      <p className="disclaimer">
        Market data shown is simulated for demo purposes — not real prices.
      </p>

      <div className="auth-card">
        <h2>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="auth-field">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting
              ? mode === 'login'
                ? 'Logging in…'
                : 'Creating account…'
              : mode === 'login'
                ? 'Log in'
                : 'Sign up'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError(null)
          }}
        >
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Log in'}
        </button>
      </div>
    </main>
  )
}

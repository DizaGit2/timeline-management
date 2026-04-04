import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../api/auth'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Email"
          id="email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={loading}
        />
        <FormField
          label="Password"
          id="password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={loading}
        />

        <div style={s.forgotRow}>
          <Link to="/forgot-password" style={s.link}>
            Forgot password?
          </Link>
        </div>

        {error && <div style={s.errorBanner}>{error}</div>}

        <button type="submit" disabled={loading} style={s.btn}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p style={s.footer}>
        Don&apos;t have an account?{' '}
        <Link to="/register" style={s.link}>
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}

const s: Record<string, React.CSSProperties> = {
  forgotRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '1rem',
    marginTop: '-0.5rem',
  },
  link: { color: '#6366f1', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
  errorBanner: {
    background: '#fff5f5',
    border: '1px solid #fca5a5',
    borderRadius: 8,
    padding: '0.625rem 0.75rem',
    fontSize: 13,
    color: '#dc2626',
    marginBottom: '1rem',
  },
  btn: {
    width: '100%',
    padding: '0.75rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '1rem',
  },
  footer: { margin: 0, textAlign: 'center', fontSize: 13, color: '#64748b' },
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)
    // Password reset is not yet implemented in the backend.
    // Simulate the request so the UI flow is complete.
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a reset link to ${email}`}>
        <div style={s.successBox}>
          <span style={s.checkmark}>✓</span>
          <p style={s.successText}>
            If an account with that email exists, you&apos;ll receive a password reset link
            shortly.
          </p>
        </div>
        <Link to="/login" style={s.backBtn}>
          Back to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link"
    >
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

        {error && <div style={s.errorBanner}>{error}</div>}

        <button type="submit" disabled={loading} style={s.btn}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p style={s.footer}>
        <Link to="/login" style={s.link}>
          ← Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

const s: Record<string, React.CSSProperties> = {
  successBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: 8,
    padding: '1rem',
    marginBottom: '1.5rem',
  },
  checkmark: { fontSize: 18, color: '#22c55e', flexShrink: 0 },
  successText: { margin: 0, fontSize: 14, color: '#166534' },
  backBtn: {
    display: 'block',
    textAlign: 'center',
    padding: '0.75rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
  },
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
  link: { color: '#6366f1', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
}

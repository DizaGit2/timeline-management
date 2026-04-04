import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <AuthLayout title="Invalid link" subtitle="This reset link is missing a token.">
        <p style={s.bodyText}>
          Please check the link in your email or request a new one.
        </p>
        <Link to="/forgot-password" style={s.btn}>
          Request new link
        </Link>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="Your password has been reset successfully.">
        <Link to="/login" style={s.btn}>
          Sign in with new password
        </Link>
      </AuthLayout>
    )
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (password.length < 8) errs.password = 'Password must be at least 8 characters.'
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError('')
    if (!validate()) return

    setLoading(true)
    // Password reset endpoint not yet implemented in the backend.
    // Simulate the request so the UI flow is complete.
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    setDone(true)
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your new password below">
      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="New password"
          id="password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Min. 8 characters"
          autoComplete="new-password"
          disabled={loading}
          error={fieldErrors.password}
        />
        <FormField
          label="Confirm new password"
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Repeat your password"
          autoComplete="new-password"
          disabled={loading}
          error={fieldErrors.confirmPassword}
        />

        {apiError && <div style={s.errorBanner}>{apiError}</div>}

        <button type="submit" disabled={loading} style={s.btnSubmit}>
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  )
}

const s: Record<string, React.CSSProperties> = {
  bodyText: { fontSize: 14, color: '#64748b', marginBottom: '1.5rem' },
  btn: {
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
  btnSubmit: {
    width: '100%',
    padding: '0.75rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
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
}

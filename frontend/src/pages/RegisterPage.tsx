import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../api/auth'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [orgName, setOrgName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!orgName.trim()) errs.orgName = 'Organization name is required.'
    if (!name.trim()) errs.name = 'Your name is required.'
    if (!email) errs.email = 'Email is required.'
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
    try {
      await register(email, password, name.trim(), orgName.trim())
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message)
      } else {
        setApiError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your organization and admin account"
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Organization name"
          id="orgName"
          value={orgName}
          onChange={setOrgName}
          placeholder="Acme Corp"
          autoComplete="organization"
          disabled={loading}
          error={fieldErrors.orgName}
        />
        <FormField
          label="Your full name"
          id="name"
          value={name}
          onChange={setName}
          placeholder="Jane Smith"
          autoComplete="name"
          disabled={loading}
          error={fieldErrors.name}
        />
        <FormField
          label="Work email"
          id="email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="jane@acme.com"
          autoComplete="email"
          disabled={loading}
          error={fieldErrors.email}
        />
        <FormField
          label="Password"
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
          label="Confirm password"
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

        <button type="submit" disabled={loading} style={s.btn}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p style={s.footer}>
        Already have an account?{' '}
        <Link to="/login" style={s.link}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

const s: Record<string, React.CSSProperties> = {
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

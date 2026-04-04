import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  children: ReactNode
}

export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.brand}>
          <span style={s.logo}>⏱</span>
          <span style={s.brandName}>Timeline</span>
        </div>
        <h1 style={s.title}>{title}</h1>
        {subtitle && <p style={s.subtitle}>{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '2.5rem',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: '1.5rem',
  },
  logo: { fontSize: 28 },
  brandName: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1e293b',
    letterSpacing: '-0.5px',
  },
  title: {
    margin: '0 0 0.25rem',
    fontSize: 24,
    fontWeight: 700,
    color: '#1e293b',
  },
  subtitle: {
    margin: '0 0 1.5rem',
    fontSize: 14,
    color: '#64748b',
  },
}

import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Navbar } from '../components/Navbar'

export function DashboardPage() {
  const { user } = useAuth()

  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  return (
    <div style={s.page}>
      <Navbar />

      <main style={s.main}>
        <h1 style={s.heading}>
          Welcome back{user?.name ? `, ${user.name}` : ''}!
        </h1>
        <p style={s.sub}>
          You are signed in as <strong>{user?.email}</strong> with role{' '}
          <strong>{user?.role}</strong>.
        </p>

        <div style={s.grid}>
          <StatCard label="Schedules" value="—" color="#6366f1" />
          <StatCard label="Employees" value="—" color="#0ea5e9" />
          <StatCard label="Shifts this week" value="—" color="#10b981" />
        </div>

        {isManagerOrAdmin && (
          <div style={s.quickLinks}>
            <h2 style={s.sectionTitle}>Quick Actions</h2>
            <div style={s.quickLinkGrid}>
              <Link to="/schedules" style={s.quickLink}>
                <span style={s.quickLinkIcon}>📅</span>
                <span>Manage Schedules</span>
              </Link>
              <Link to="/shifts" style={s.quickLink}>
                <span style={s.quickLinkIcon}>📋</span>
                <span>Manage Shifts</span>
              </Link>
              <Link to="/employees" style={s.quickLink}>
                <span style={s.quickLinkIcon}>👥</span>
                <span>Manage Employees</span>
              </Link>
            </div>
          </div>
        )}

        <div style={s.placeholder}>
          <p style={s.placeholderText}>
            Dashboard content will be built in subsequent sprints.
          </p>
        </div>
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div style={{ ...s.card, borderTop: `4px solid ${color}` }}>
      <p style={s.cardValue}>{value}</p>
      <p style={s.cardLabel}>{label}</p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f8fafc' },
  main: { padding: '2rem', maxWidth: 960, margin: '0 auto' },
  heading: { margin: '0 0 0.5rem', fontSize: 26, fontWeight: 700, color: '#1e293b' },
  sub: { margin: '0 0 2rem', fontSize: 14, color: '#64748b' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: '2rem' },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.25rem 1.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardValue: { margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: '#1e293b' },
  cardLabel: { margin: 0, fontSize: 13, color: '#64748b' },
  quickLinks: { marginBottom: '2rem' },
  sectionTitle: { margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: '#1e293b' },
  quickLinkGrid: { display: 'flex', gap: 12, flexWrap: 'wrap' as const },
  quickLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 18px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    textDecoration: 'none',
    color: '#1e293b',
    fontSize: 14,
    fontWeight: 500,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  quickLinkIcon: { fontSize: 18 },
  placeholder: {
    background: '#fff',
    border: '2px dashed #e2e8f0',
    borderRadius: 12,
    padding: '3rem',
    textAlign: 'center',
  },
  placeholderText: { margin: 0, color: '#94a3b8', fontSize: 14 },
}

import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ROLE_BADGE: Record<string, string> = {
  ADMIN: '#6366f1',
  MANAGER: '#0ea5e9',
  VIEWER: '#64748b',
}

const MOBILE_BREAKPOINT = 640

export function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Close menu on navigation
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  function isActive(path: string) {
    return location.pathname === path
  }

  function navLinkStyle(path: string): React.CSSProperties {
    return {
      ...s.navLink,
      ...(isActive(path) ? s.navLinkActive : {}),
      ...(isMobile ? s.navLinkMobile : {}),
    }
  }

  const navLinks = (
    <>
      <Link to="/dashboard" style={navLinkStyle('/dashboard')}>
        Dashboard
      </Link>
      {isManagerOrAdmin && (
        <>
          <Link to="/schedules" style={navLinkStyle('/schedules')}>
            Schedules
          </Link>
          <Link to="/shifts" style={navLinkStyle('/shifts')}>
            Shifts
          </Link>
          <Link to="/employees" style={navLinkStyle('/employees')}>
            Employees
          </Link>
          <Link to="/reports" style={navLinkStyle('/reports')}>
            Reports
          </Link>
        </>
      )}
      <Link to="/my-schedule" style={navLinkStyle('/my-schedule')}>
        My Schedule
      </Link>
    </>
  )

  return (
    <header style={s.header}>
      <div style={s.topRow}>
        <div style={s.brand}>
          <Link to="/dashboard" style={s.brandLink}>
            <span style={s.logo}>⏱</span>
            <span style={s.brandName}>Timeline Management</span>
          </Link>
        </div>

        {!isMobile && (
          <nav style={s.nav} aria-label="Main navigation">
            {navLinks}
          </nav>
        )}

        <div style={s.headerRight}>
          {user && (
            <span
              style={{
                ...s.roleBadge,
                background: ROLE_BADGE[user.role] ?? '#64748b',
              }}
            >
              {user.role}
            </span>
          )}
          {!isMobile && (
            <button onClick={() => void logout()} style={s.logoutBtn}>
              Sign out
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setMenuOpen((o) => !o)}
              style={s.hamburger}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          )}
        </div>
      </div>

      {isMobile && menuOpen && (
        <nav style={s.mobileMenu} aria-label="Main navigation">
          {navLinks}
          <button onClick={() => void logout()} style={s.mobileLogoutBtn}>
            Sign out
          </button>
        </nav>
      )}
    </header>
  )
}

const s: Record<string, React.CSSProperties> = {
  header: {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    height: 60,
  },
  brand: { display: 'flex', alignItems: 'center' },
  brandLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
  },
  logo: { fontSize: 22 },
  brandName: { fontSize: 16, fontWeight: 700, color: '#1e293b' },
  nav: { display: 'flex', gap: 4, alignItems: 'center' },
  navLink: {
    padding: '5px 12px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    color: '#475569',
    textDecoration: 'none',
    background: 'transparent',
  },
  navLinkActive: {
    color: '#4f46e5',
    background: '#eef2ff',
  },
  navLinkMobile: {
    display: 'block',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 15,
    borderBottom: '1px solid #f1f5f9',
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  roleBadge: {
    padding: '2px 10px',
    borderRadius: 20,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  logoutBtn: {
    padding: '6px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 8,
    background: '#fff',
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
  hamburger: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    color: '#475569',
    padding: '4px 8px',
    lineHeight: 1,
  },
  mobileMenu: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 16px 16px',
    borderTop: '1px solid #f1f5f9',
    background: '#fff',
  },
  mobileLogoutBtn: {
    marginTop: 8,
    padding: '10px 16px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 8,
    background: '#fff',
    fontSize: 14,
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
    textAlign: 'left',
  },
}

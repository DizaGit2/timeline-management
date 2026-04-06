import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export function AppShell() {
  return (
    <div style={s.shell}>
      <Navbar />
      <Outlet />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
  },
}

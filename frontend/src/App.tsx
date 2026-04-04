import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { PrivateRoute } from './components/PrivateRoute'
import { PublicOnlyRoute } from './components/PublicOnlyRoute'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { ShiftsPage } from './pages/ShiftsPage'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public-only routes — redirect authenticated users to /dashboard */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Public routes accessible to everyone */}
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected routes — all authenticated roles */}
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          {/* Shift management — Admin + Manager */}
          <Route element={<PrivateRoute roles={['ADMIN', 'MANAGER']} />}>
            <Route path="/shifts" element={<ShiftsPage />} />
          </Route>

          {/* Admin-only routes */}
          <Route element={<PrivateRoute roles={['ADMIN']} />}>
            <Route path="/admin/*" element={<AdminPlaceholder />} />
          </Route>

          {/* Admin + Manager routes */}
          <Route element={<PrivateRoute roles={['ADMIN', 'MANAGER']} />}>
            <Route path="/manager/*" element={<ManagerPlaceholder />} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

function AdminPlaceholder() {
  return (
    <div style={placeholder}>
      <h2>Admin Area</h2>
      <p>Coming soon.</p>
    </div>
  )
}

function ManagerPlaceholder() {
  return (
    <div style={placeholder}>
      <h2>Manager Area</h2>
      <p>Coming soon.</p>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div style={placeholder}>
      <h2>404 — Page not found</h2>
      <a href="/dashboard">Go to dashboard</a>
    </div>
  )
}

const placeholder: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  fontFamily: 'sans-serif',
  gap: 8,
}

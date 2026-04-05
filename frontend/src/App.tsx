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
import { SchedulePage } from './pages/SchedulePage'
import { SchedulesPage } from './pages/SchedulesPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { MySchedulePage } from './pages/MySchedulePage'
import { AvailabilityPage } from './pages/AvailabilityPage'
import { ReportsPage } from './pages/ReportsPage'
import { ManagerSwapRequestsPage } from './pages/ManagerSwapRequestsPage'
import { MySwapRequestsPage } from './pages/MySwapRequestsPage'

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
            <Route path="/my-schedule" element={<MySchedulePage />} />
            <Route path="/availability/:employeeId" element={<AvailabilityPage />} />
            <Route path="/my-swap-requests" element={<MySwapRequestsPage />} />
          </Route>

          {/* Shift management — Admin + Manager */}
          <Route element={<PrivateRoute roles={['ADMIN', 'MANAGER']} />}>
            <Route path="/shifts" element={<ShiftsPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/swap-requests" element={<ManagerSwapRequestsPage />} />
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

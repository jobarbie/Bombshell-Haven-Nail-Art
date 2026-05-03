import { Analytics } from "@vercel/analytics/next"
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import ToastNotification from './components/ToastNotification'
import PaymentPage from './views/customer/PaymentPage'  // ← add this

// Customer view (public)
import CustomerLayout from './views/customer/CustomerLayout'
import HomePage from './views/customer/HomePage'
import BookingPage from './views/customer/BookingPage'
import CustomerAuth from './views/customer/CustomerAuth'

// Nail tech view (dashboard)
import NailTechLayout from './views/nailtech/NailTechLayout'
import NailTechAuthLayout from './views/nailtech/NailTechAuthLayout'
import NailTechLogin from './views/nailtech/NailTechLogin'
import NailTechDashboard from './views/nailtech/NailTechDashboard'


function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <p>Loading...</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/nailtech/login" replace />
  return children
}

function CustomerProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <p>Loading...</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastNotification />
        <Routes>
        {/* Customer-facing routes */}
        <Route path="/" element={<CustomerLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<CustomerAuth />} />
          <Route path="book" element={
            <CustomerProtectedRoute>
              <BookingPage />
            </CustomerProtectedRoute>
          } />
          <Route path="payment" element={
            <CustomerProtectedRoute>
              <PaymentPage />
            </CustomerProtectedRoute>
          } />
        </Route>

        {/* Redirect /nailtech/ to login (trailing slash fix) */}
        <Route path="/nailtech/" element={<Navigate to="/nailtech/login" replace />} />

        {/* Nail tech auth - login only (signup disabled, accounts created by admin) */}
        <Route path="/nailtech/login" element={
          <NailTechAuthLayout>
            <NailTechLogin />
          </NailTechAuthLayout>
        } />
        {/* Redirect signup to login (signup disabled) */}
        <Route path="/nailtech/signup" element={<Navigate to="/nailtech/login" replace />} />

        {/* Nail tech dashboard (protected) */}
        <Route
          path="/nailtech"
          element={
            <ProtectedRoute>
              <NailTechLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/nailtech/dashboard" replace />} />
          <Route path="dashboard" element={<NailTechDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  )
}
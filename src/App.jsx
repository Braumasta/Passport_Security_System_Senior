import { useEffect, useState } from 'react'
import { Navigate, Routes, Route, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import PostPage from './pages/PostPage'
import ContactPage from './pages/ContactPage'
import OperationsPage from './pages/OperationsPage'
import ManagementPage from './pages/ManagementPage'
import PassportApplicationPage from './pages/PassportApplicationPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AccountPage from './pages/AccountPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import LegalNoticePage from './pages/LegalNoticePage'
import InformationPage from './pages/InformationPage'
import { clearSession, getStoredSession, saveSession } from './services/authStorage'
import { getCurrentUser } from './services/passportService'

function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(getStoredSession)
  const canAccessOperations = ['admin', 'officer'].includes(session.user?.role)
  const canAccessManagement = session.user?.role === 'admin'
  const canAccessPassportApplication =
    session.user?.role === 'applicant' && session.user?.verification_status === 'verified'

  const handleLogin = ({ token, user }) => {
    saveSession({ token, user })
    setSession({ token, user })
  }

  const handleLogout = () => {
    clearSession()
    setSession({ token: '', user: null })
    navigate('/login', { replace: true })
  }

  const handleUserUpdate = (user) => {
    setSession((previousSession) => {
      const nextSession = { ...previousSession, user }
      saveSession(nextSession)
      return nextSession
    })
  }

  useEffect(() => {
    if (!session.token || !session.user) {
      return undefined
    }

    let isMounted = true

    const refreshCurrentUser = async () => {
      try {
        const response = await getCurrentUser(session.token)
        if (isMounted && response.data) {
          handleUserUpdate(response.data)
        }
      } catch {
        // Keep the current session if a background refresh fails.
      }
    }

    window.addEventListener('focus', refreshCurrentUser)

    return () => {
      isMounted = false
      window.removeEventListener('focus', refreshCurrentUser)
    }
  }, [session.token, session.user?.user_id])

  return (
    <div className="d-flex flex-column min-vh-100">
      <Header currentUser={session.user} onLogout={handleLogout} />
      <main className="flex-grow-1">
        <Routes>
          <Route path="/" element={<HomePage currentUser={session.user} />} />
          <Route
            path="/operations"
            element={
              canAccessOperations ? (
                <OperationsPage token={session.token} currentUser={session.user} />
              ) : (
                <Navigate to={session.user ? '/account' : '/login'} replace />
              )
            }
          />
          <Route
            path="/management"
            element={
              canAccessManagement ? (
                <ManagementPage token={session.token} currentUser={session.user} />
              ) : (
                <Navigate to={session.user ? '/account' : '/login'} replace />
              )
            }
          />
          <Route
            path="/passport-application"
            element={
              canAccessPassportApplication ? (
                <PassportApplicationPage
                  token={session.token}
                  currentUser={session.user}
                  onUserUpdate={handleUserUpdate}
                />
              ) : (
                <Navigate to={session.user ? '/account' : '/login'} replace />
              )
            }
          />
          <Route
            path="/login"
            element={
              session.user ? (
                <Navigate
                  to={
                    session.user.role === 'admin' || session.user.role === 'officer'
                      ? '/operations'
                      : session.user.verification_status === 'verified'
                        ? '/passport-application'
                        : '/account'
                  }
                  replace
                />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/register"
            element={
              session.user ? (
                <Navigate
                  to={
                    session.user.role === 'admin' || session.user.role === 'officer'
                      ? '/operations'
                      : session.user.verification_status === 'verified'
                        ? '/passport-application'
                        : '/account'
                  }
                  replace
                />
              ) : (
                <RegisterPage />
              )
            }
          />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/account"
            element={
              <AccountPage
                currentUser={session.user}
                token={session.token}
                onUserUpdate={handleUserUpdate}
              />
            }
          />
          <Route path="/posts/:id" element={<PostPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/legal-notice" element={<LegalNoticePage />} />
          <Route path="/information/:slug" element={<InformationPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App

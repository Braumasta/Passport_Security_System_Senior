import { Link } from 'react-router-dom'
import { Alert, Container } from 'react-bootstrap'
import PassportApplicationForm from '../components/PassportApplicationForm'

const PassportApplicationPage = ({ token, currentUser, onUserUpdate }) => {
  const isApplicantPendingVerification =
    token &&
    currentUser?.role === 'applicant' &&
    currentUser?.verification_status !== 'verified'
  const displayName =
    currentUser?.full_name ||
    [currentUser?.first_name, currentUser?.middle_name, currentUser?.last_name].filter(Boolean).join(' ') ||
    currentUser?.email

  const statusMessage = !token
    ? (
        <>
          You must log in first before submitting a passport application.
        </>
      )
    : isApplicantPendingVerification
      ? (
          <>
            Logged in as <strong>{displayName}</strong> ({currentUser.role}). Your account is currently{' '}
            <strong>{currentUser.verification_status}</strong>, so you cannot submit a passport application until an
            admin or officer verifies your account.
          </>
        )
      : currentUser
        ? (
            <>
              Logged in as <strong>{displayName}</strong> ({currentUser.role}). Your account is ready for passport
              application submission.
            </>
          )
        : null

  return (
    <div className="ps-passport-application ps-page-shell py-5">
      <Container>
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/">Homepage</Link>
            </li>
            <li className="breadcrumb-item">
              <Link to="/posts/11">Biometric passport</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Passport application
            </li>
          </ol>
        </nav>

        <div className="mb-4">
          <h1 style={{ color: 'var(--ps-primary)' }}>Passport Application</h1>
          <p className="text-muted lead">
            Apply online for a new or renewed biometric passport. Fill in your information, upload the required documents,
            and submit your request. You will receive a confirmation ticket by email.
          </p>
        </div>

        {statusMessage && <Alert variant={token && !isApplicantPendingVerification ? 'secondary' : 'warning'}>{statusMessage}</Alert>}

        <PassportApplicationForm token={token} currentUser={currentUser} onUserUpdate={onUserUpdate} />
      </Container>
    </div>
  )
}

export default PassportApplicationPage

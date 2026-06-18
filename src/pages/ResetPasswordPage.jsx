import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Col, Container, Form, InputGroup, Row } from 'react-bootstrap'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { requestPasswordReset, resetPassword } from '../services/passportService'

const CODE_LENGTH = 8
const RESEND_COOLDOWN_SECONDS = 60
const PENDING_RESET_EMAIL_KEY = 'pendingPasswordResetEmail'

const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const inputRefs = useRef([])
  const [email] = useState(
    location.state?.resetEmail || sessionStorage.getItem(PENDING_RESET_EMAIL_KEY) || ''
  )
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''))
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState(location.state?.resetMessage || '')
  const [devResetCode, setDevResetCode] = useState(location.state?.devResetCode || '')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(location.state?.startCooldown || 0)

  useEffect(() => {
    if (location.state?.resetEmail) {
      sessionStorage.setItem(PENDING_RESET_EMAIL_KEY, location.state.resetEmail)
    }
  }, [location.state])

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined
    }

    const timer = setTimeout(() => setCooldown((previous) => previous - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const resetCode = digits.join('')

  const updateDigit = (index, rawValue) => {
    const nextValue = rawValue.replace(/\D/g, '').slice(-1)
    const nextDigits = [...digits]
    nextDigits[index] = nextValue
    setDigits(nextDigits)

    if (nextValue && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)

    if (!pasted) {
      return
    }

    event.preventDefault()

    const nextDigits = Array(CODE_LENGTH).fill('')
    pasted.split('').forEach((character, index) => {
      nextDigits[index] = character
    })

    setDigits(nextDigits)
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH) - 1]?.focus()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setInfoMessage('')

    if (!email.trim()) {
      setErrorMessage('No password reset email is attached to this page.')
      return
    }

    if (resetCode.length !== CODE_LENGTH) {
      setErrorMessage('Enter the full 8-digit password reset code.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await resetPassword({
        email: email.trim(),
        code: resetCode,
        password,
      })

      sessionStorage.removeItem(PENDING_RESET_EMAIL_KEY)
      setSuccessMessage(response.message || 'Password reset successfully')
      setTimeout(() => navigate('/login'), 1500)
    } catch (error) {
      setErrorMessage(error.message || 'Password reset failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendCode = async () => {
    if (!email.trim()) {
      setErrorMessage('No password reset email is attached to this page.')
      return
    }

    setIsResending(true)
    setErrorMessage('')
    setInfoMessage('')
    setDevResetCode('')

    try {
      const response = await requestPasswordReset(email.trim())
      setInfoMessage(response.message || 'Password reset code sent successfully.')
      setDevResetCode(response.data?.dev_reset_code || '')
      setCooldown(RESEND_COOLDOWN_SECONDS)
      setDigits(Array(CODE_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } catch (error) {
      setErrorMessage(error.message || 'Failed to resend password reset code')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="ps-page-shell py-5">
      <Container>
        <Row className="justify-content-center">
          <Col md={8} lg={6}>
            <Card className="border-0 shadow">
              <Card.Body className="p-4">
                <h1 className="h3 mb-3" style={{ color: 'var(--ps-primary)' }}>Reset Password</h1>
                <p className="text-muted">
                  Enter the 8-digit code sent to your email, then choose a new password for your account.
                </p>

                {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
                {infoMessage && <Alert variant="success">{infoMessage}</Alert>}
                {successMessage && <Alert variant="success">{successMessage}</Alert>}
                {devResetCode && (
                  <Alert variant="secondary">
                    <strong>Local development password reset code:</strong> {devResetCode}
                  </Alert>
                )}

                {!email && (
                  <Alert variant="warning">
                    No password reset email is currently attached to this page. Go back to{' '}
                    <Link to="/forgot-password">forgot password</Link> and restart the reset flow.
                  </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <Form.Label>Reset Email</Form.Label>
                    <div className="border rounded px-3 py-2 bg-light text-break">
                      {email || 'Not available'}
                    </div>
                  </div>

                  <Form.Group className="mb-4">
                    <Form.Label>8-Digit Reset Code</Form.Label>
                    <div className="d-flex gap-2 justify-content-center flex-wrap" onPaste={handlePaste}>
                      {digits.map((digit, index) => (
                        <Form.Control
                          key={index}
                          ref={(element) => {
                            inputRefs.current[index] = element
                          }}
                          value={digit}
                          inputMode="numeric"
                          maxLength={1}
                          className="text-center fw-semibold"
                          style={{ maxWidth: '3rem', fontSize: '1.25rem' }}
                          onChange={(event) => updateDigit(index, event.target.value)}
                          onKeyDown={(event) => handleKeyDown(index, event)}
                        />
                      ))}
                    </div>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>New Password</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="outline-secondary"
                        onClick={() => setShowPassword((previous) => !previous)}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </Button>
                    </InputGroup>
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label>Confirm New Password</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="outline-secondary"
                        onClick={() => setShowConfirmPassword((previous) => !previous)}
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </Button>
                    </InputGroup>
                  </Form.Group>

                  <div className="d-flex flex-column flex-sm-row gap-2">
                    <Button
                      type="button"
                      variant="outline-primary"
                      className="flex-fill"
                      onClick={handleResendCode}
                      disabled={isResending || cooldown > 0 || !email}
                    >
                      {cooldown > 0
                        ? `Resend Code (${cooldown}s)`
                        : isResending
                          ? 'Sending...'
                          : 'Resend Code'}
                    </Button>
                    <Button type="submit" variant="primary" className="flex-fill" disabled={isSubmitting || !email}>
                      {isSubmitting ? 'Resetting password...' : 'Confirm and Reset Password'}
                    </Button>
                  </div>
                </Form>

                <div className="text-center mt-3">
                  <Link to="/login">Back to login</Link>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default ResetPasswordPage

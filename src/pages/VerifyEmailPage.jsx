import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Col, Container, Form, Row } from 'react-bootstrap'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { resendVerificationEmail, verifyEmailAddress } from '../services/passportService'

const CODE_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60
const PENDING_VERIFICATION_EMAIL_KEY = 'pendingVerificationEmail'

const VerifyEmailPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const inputRefs = useRef([])
  const [email, setEmail] = useState(
    location.state?.registeredEmail || sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) || ''
  )
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''))
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState(location.state?.registrationMessage || '')
  const [devVerificationCode, setDevVerificationCode] = useState(location.state?.devVerificationCode || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(location.state?.startCooldown || 0)

  useEffect(() => {
    if (location.state?.registeredEmail) {
      sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, location.state.registeredEmail)
    }
  }, [location.state])

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined
    }

    const timer = setTimeout(() => setCooldown((previous) => previous - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const verificationCode = digits.join('')

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

  const handleConfirm = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setInfoMessage('')

    if (!email.trim()) {
      setErrorMessage('Email address is required.')
      return
    }

    if (verificationCode.length !== CODE_LENGTH) {
      setErrorMessage('Enter the full 6-digit verification code.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await verifyEmailAddress({
        email: email.trim(),
        code: verificationCode,
      })

      sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY)

      navigate('/login', {
        state: {
          registrationMessage: response.message || 'Email verified successfully.',
          registeredEmail: email.trim(),
        },
      })
    } catch (error) {
      setErrorMessage(error.message || 'Verification failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendCode = async () => {
    if (!email.trim()) {
      setErrorMessage('Enter your email address first.')
      return
    }

    setIsResending(true)
    setErrorMessage('')
    setInfoMessage('')
    setDevVerificationCode('')

    try {
      const normalizedEmail = email.trim()
      const response = await resendVerificationEmail(normalizedEmail)
      sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, normalizedEmail)
      setInfoMessage(response.message || 'Verification code sent successfully.')
      setDevVerificationCode(response.data?.dev_verification_code || '')
      setCooldown(RESEND_COOLDOWN_SECONDS)
      setDigits(Array(CODE_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } catch (error) {
      setErrorMessage(error.message || 'Failed to resend verification code')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="ps-page-shell py-5">
      <Container>
        <Row className="justify-content-center">
          <Col md={8} lg={6}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4">
                <h1 className="h3 mb-3" style={{ color: 'var(--ps-primary)' }}>Verify Email</h1>
                <p className="text-muted">
                  Enter the 6-digit code sent to your email address to verify the account.
                </p>

                {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
                {infoMessage && <Alert variant="success">{infoMessage}</Alert>}
                {devVerificationCode && (
                  <Alert variant="secondary">
                    <strong>Local development verification code:</strong> {devVerificationCode}
                  </Alert>
                )}

                {!email && (
                  <Alert variant="warning">
                    No verification email is currently attached to this page. Go back to <Link to="/login">login</Link>{' '}
                    or <Link to="/register">create account</Link> and restart the verification flow.
                  </Alert>
                )}

                <Form onSubmit={handleConfirm}>
                  <div className="mb-3">
                    <Form.Label>Verification Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={email}
                      readOnly
                      placeholder="Enter the email used during registration"
                      required
                    />
                    <Form.Text className="text-muted">
                      This email is locked to the account currently waiting for verification.
                    </Form.Text>
                  </div>

                  <Form.Group className="mb-4">
                    <Form.Label>6-Digit Verification Code</Form.Label>
                    <div className="d-flex gap-2 justify-content-center" onPaste={handlePaste}>
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

                  <div className="d-flex flex-column flex-sm-row gap-2">
                    <Button type="submit" variant="primary" className="flex-fill" disabled={isSubmitting || !email}>
                      {isSubmitting ? 'Confirming...' : 'Confirm'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline-primary"
                      className="flex-fill"
                      onClick={handleResendCode}
                      disabled={isResending || cooldown > 0}
                    >
                      {cooldown > 0
                        ? `Resend Code (${cooldown}s)`
                        : isResending
                          ? 'Sending...'
                          : 'Resend Code'}
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

export default VerifyEmailPage

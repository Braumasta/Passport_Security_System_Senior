import { useState } from 'react'
import { Alert, Button, Card, Col, Container, Form, Row } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { requestPasswordReset } from '../services/passportService'

const ForgotPasswordPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const normalizedEmail = email.trim()
      const response = await requestPasswordReset(normalizedEmail)

      navigate('/reset-password', {
        state: {
          resetMessage: response.message || 'If the account exists, a password reset code has been sent.',
          resetEmail: normalizedEmail,
          devResetCode: response.data?.dev_reset_code || '',
          startCooldown: 60,
        },
      })
    } catch (error) {
      setErrorMessage(error.message || 'Failed to send reset code')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="ps-page-shell py-5">
      <Container>
        <Row className="justify-content-center">
          <Col md={8} lg={6}>
            <Card className="border-0 shadow">
              <Card.Body className="p-4">
                <h1 className="h3 mb-3" style={{ color: 'var(--ps-primary)' }}>Forgot Password</h1>
                <p className="text-muted">
                  Enter your account email address and the system will send an 8-digit password reset code.
                </p>

                {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-4">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </Form.Group>

                  <Button type="submit" variant="primary" className="w-100" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending reset code...' : 'Send Reset Code'}
                  </Button>
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

export default ForgotPasswordPage

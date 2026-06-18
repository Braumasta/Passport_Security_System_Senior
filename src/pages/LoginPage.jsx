import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Container, Form, InputGroup, Row } from 'react-bootstrap'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginUser } from '../services/passportService'

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!location.state) {
      return
    }

    if (location.state.registeredEmail) {
      setCredentials((previous) => ({ ...previous, email: location.state.registeredEmail }))
    }

    if (location.state.registrationMessage) {
      setInfoMessage(location.state.registrationMessage)
    }
  }, [location.state])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setInfoMessage('')
    setIsSubmitting(true)

    try {
      const response = await loginUser(credentials)
      onLogin(response.data)
      const fallbackPath = response.data?.user?.role === 'admin' ? '/operations' : '/passport-application'
      navigate(location.state?.from || fallbackPath)
    } catch (error) {
      if ((error.message || '').toLowerCase().includes('verify your email')) {
        navigate('/verify-email', {
          state: {
            registeredEmail: credentials.email.trim(),
            registrationMessage: 'Your email is not verified yet. Enter the 6-digit code to continue.',
            startCooldown: 0,
          },
        })
      } else {
        setErrorMessage(error.message || 'Login failed')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="ps-page-shell py-5">
      <Container>
        <Row className="justify-content-center">
          <Col md={7} lg={5}>
            <Card className="border-0 shadow">
              <Card.Body className="p-4">
                <h1 className="h3 mb-3" style={{ color: 'var(--ps-primary)' }}>Login</h1>
                <p className="text-muted">
                  Verify your email first, then log in to save the passport application directly to the backend database.
                </p>

                {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
                {infoMessage && <Alert variant="success">{infoMessage}</Alert>}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={credentials.email}
                      onChange={(event) =>
                        setCredentials((previous) => ({ ...previous, email: event.target.value }))
                      }
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        value={credentials.password}
                        onChange={(event) =>
                          setCredentials((previous) => ({ ...previous, password: event.target.value }))
                        }
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

                  <Button type="submit" variant="primary" className="w-100" disabled={isSubmitting}>
                    {isSubmitting ? 'Logging in...' : 'Log In'}
                  </Button>
                </Form>

                <div className="text-center mt-3">
                  <Link to="/forgot-password">Forgot your password?</Link>
                </div>

                <Alert variant="secondary" className="mt-4 mb-0">
                  <strong>Example accounts:</strong><br />
                  ragheed@passportsecurity.com / Hh246810<br />
                  m.zeitoun1@passportsecurity.com / Hh246810
                </Alert>

                <div className="text-center mt-3">
                  <span className="text-muted small">No account yet? </span>
                  <Link to="/register">Create account</Link>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default LoginPage

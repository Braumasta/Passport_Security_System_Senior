import { useState } from 'react'
import { Alert, Button, Card, Col, Container, Form, InputGroup, Row } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { LEBANESE_VILLAGE_OPTIONS } from '../data/lebaneseVillages'
import { registerUser } from '../services/passportService'
import './RegisterPage.css'

const GOVERNORATE_OPTIONS = [
  { value: 'beirut', label: 'Beirut' },
  { value: 'mount_lebanon', label: 'Mount Lebanon' },
  { value: 'north_lebanon', label: 'North Lebanon' },
  { value: 'akkar', label: 'Akkar' },
  { value: 'beqaa', label: 'Beqaa' },
  { value: 'baalbek_hermel', label: 'Baalbek-Hermel' },
  { value: 'south_lebanon', label: 'South Lebanon' },
  { value: 'nabatieh', label: 'Nabatieh' },
]

const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const emptySectionErrors = {
  identity: [],
  civil: [],
  contact: [],
}

const RegisterPage = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    father_name: '',
    mother_name: '',
    date_of_birth: '',
    place_of_birth: '',
    email: '',
    phone: '',
    national_id_number: '',
    gender: '',
    governorate: '',
    blood_type: '',
    marital_status: '',
    registry_number: '',
    password: '',
    confirmPassword: '',
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [sectionErrors, setSectionErrors] = useState(emptySectionErrors)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const updateField = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }))
  }

  const validateSections = () => {
    const nextErrors = {
      identity: [],
      civil: [],
      contact: [],
    }

    if (!formData.first_name.trim()) nextErrors.identity.push('First name is required.')
    if (!formData.last_name.trim()) nextErrors.identity.push('Last name is required.')

    if (!formData.father_name.trim()) nextErrors.civil.push('Father name is required.')
    if (!formData.mother_name.trim()) nextErrors.civil.push('Mother name is required.')
    if (!formData.registry_number.trim()) nextErrors.civil.push('Registry number is required.')
    if (!formData.date_of_birth) nextErrors.civil.push('Date of birth is required.')
    if (!formData.marital_status) nextErrors.civil.push('Marital status is required.')
    if (!formData.place_of_birth.trim()) nextErrors.civil.push('Place of birth is required.')
    if (!formData.blood_type) nextErrors.civil.push('Blood type is required.')

    if (!formData.national_id_number.trim()) nextErrors.contact.push('National ID number is required.')
    if (!formData.gender) nextErrors.contact.push('Gender is required.')
    if (!formData.governorate) nextErrors.contact.push('Governorate is required.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.contact.push('A valid email address is required.')
    }
    if (!/^\d{8}$/.test(formData.phone.trim())) {
      nextErrors.contact.push('Enter an 8-digit Lebanese phone number after +961.')
    }
    if (!formData.password || formData.password.length < 6) {
      nextErrors.contact.push('Password must be at least 6 characters long.')
    }
    if (formData.password !== formData.confirmPassword) {
      nextErrors.contact.push('Passwords do not match.')
    }

    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSectionErrors(emptySectionErrors)

    const nextSectionErrors = validateSections()
    const hasSectionErrors = Object.values(nextSectionErrors).some((errors) => errors.length)

    if (hasSectionErrors) {
      setSectionErrors(nextSectionErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const response = await registerUser({
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim(),
        last_name: formData.last_name.trim(),
        father_name: formData.father_name.trim(),
        mother_name: formData.mother_name.trim(),
        date_of_birth: formData.date_of_birth,
        place_of_birth: formData.place_of_birth.trim(),
        email: formData.email.trim(),
        phone: `+961${formData.phone.trim()}`,
        national_id_number: formData.national_id_number.trim(),
        gender: formData.gender,
        governorate: formData.governorate,
        blood_type: formData.blood_type,
        marital_status: formData.marital_status,
        registry_number: formData.registry_number.trim(),
        password: formData.password,
      })

      navigate('/verify-email', {
        state: {
          registrationMessage: response.message || 'Account created successfully.',
          registeredEmail: formData.email.trim(),
          devVerificationCode: response.data?.dev_verification_code || '',
          startCooldown: 60,
        },
      })
    } catch (error) {
      setErrorMessage(error.message || 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const SectionErrorBlock = ({ errors }) =>
    errors.length ? (
      <Alert variant="danger" className="ps-register-section-alert">
        <ul className="mb-0">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </Alert>
    ) : null

  return (
    <div className="ps-register-page ps-page-shell py-5">
      <Container>
        <Row className="justify-content-center">
          <Col lg={10} xl={9}>
            <Card className="ps-register-card">
              <Card.Body>
                <div className="ps-register-heading">
                  <span>Applicant registration</span>
                  <h1>Create Account</h1>
                  <p>
                  Public registration creates an <strong>applicant</strong> account only. After registration, verify
                  your email, log in, and then submit your national ID images and selfie from your account page.
                </p>
                </div>

                {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

                <Form onSubmit={handleSubmit} noValidate>
                  <div className="ps-register-section">
                    <h2>Identity Details</h2>
                    <SectionErrorBlock errors={sectionErrors.identity} />
                  <div className="ps-register-grid ps-register-grid-three">
                      <Form.Group className="mb-3">
                        <Form.Label>First Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.first_name}
                          onChange={(event) => updateField('first_name', event.target.value)}
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Middle Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.middle_name}
                          onChange={(event) => updateField('middle_name', event.target.value)}
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Last Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.last_name}
                          onChange={(event) => updateField('last_name', event.target.value)}
                          required
                        />
                      </Form.Group>
                  </div>
                  </div>

                  <div className="ps-register-section">
                    <h2>Civil Record Details</h2>
                    <SectionErrorBlock errors={sectionErrors.civil} />
                  <div className="ps-register-grid">
                      <Form.Group className="mb-3">
                        <Form.Label>Father Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.father_name}
                          onChange={(event) => updateField('father_name', event.target.value)}
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Mother Name</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.mother_name}
                          onChange={(event) => updateField('mother_name', event.target.value)}
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Registry Number</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.registry_number}
                          onChange={(event) => updateField('registry_number', event.target.value)}
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Date of Birth</Form.Label>
                        <Form.Control
                          type="date"
                          value={formData.date_of_birth}
                          onChange={(event) => updateField('date_of_birth', event.target.value)}
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Marital Status</Form.Label>
                        <Form.Select
                          value={formData.marital_status}
                          onChange={(event) => updateField('marital_status', event.target.value)}
                          required
                        >
                          <option value="">Select marital status</option>
                          <option value="single">Single</option>
                          <option value="married">Married</option>
                          <option value="divorced">Divorced</option>
                          <option value="widowed">Widowed</option>
                        </Form.Select>
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Place of Birth</Form.Label>
                        <Form.Select
                          value={formData.place_of_birth}
                          onChange={(event) => updateField('place_of_birth', event.target.value)}
                          required
                        >
                          <option value="">Select place of birth</option>
                          {LEBANESE_VILLAGE_OPTIONS.map((village) => (
                            <option key={village} value={village}>{village}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Blood Type</Form.Label>
                        <Form.Select
                          value={formData.blood_type}
                          onChange={(event) => updateField('blood_type', event.target.value)}
                          required
                        >
                          <option value="">Select blood type</option>
                          {BLOOD_TYPE_OPTIONS.map((bloodType) => (
                            <option key={bloodType} value={bloodType}>{bloodType}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                  </div>
                  </div>

                  <div className="ps-register-section">
                    <h2>Contact and Security</h2>
                    <SectionErrorBlock errors={sectionErrors.contact} />
                  <div className="ps-register-grid">
                      <Form.Group className="mb-3">
                        <Form.Label>National ID Number</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.national_id_number}
                          onChange={(event) => updateField('national_id_number', event.target.value)}
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Gender</Form.Label>
                        <Form.Select
                          value={formData.gender}
                          onChange={(event) => updateField('gender', event.target.value)}
                          required
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </Form.Select>
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Governorate</Form.Label>
                        <Form.Select
                          value={formData.governorate}
                          onChange={(event) => updateField('governorate', event.target.value)}
                          required
                        >
                          <option value="">Select governorate</option>
                          {GOVERNORATE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          type="email"
                          value={formData.email}
                          onChange={(event) => updateField('email', event.target.value)}
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Phone Number</Form.Label>
                        <InputGroup>
                          <InputGroup.Text>+961</InputGroup.Text>
                          <Form.Control
                            type="tel"
                            inputMode="numeric"
                            maxLength={8}
                            pattern="\d{8}"
                            value={formData.phone}
                            onChange={(event) =>
                              updateField('phone', event.target.value.replace(/\D/g, '').slice(0, 8))
                            }
                            required
                          />
                        </InputGroup>
                        <Form.Text className="text-muted">Enter 8 digits.</Form.Text>
                      </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(event) => updateField('password', event.target.value)}
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

                  <Form.Group className="mb-3">
                    <Form.Label>Confirm Password</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(event) => updateField('confirmPassword', event.target.value)}
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

                  <Button type="submit" variant="primary" className="w-100 ps-register-submit-button" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating account...' : 'Create Account'}
                  </Button>
                  </div>
                  </div>
                </Form>
                <div className="text-center mt-3">
                  <span className="text-muted small">Already have an account? </span>
                  <Link to="/login">Login</Link>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default RegisterPage

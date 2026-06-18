import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap'
import {
  addApplicationDocument,
  createApplicant,
  createPassportApplication,
  getApplications,
  runApplicationAiReview,
} from '../services/passportService'
import { LEBANESE_VILLAGE_OPTIONS } from '../data/lebaneseVillages'
import { toDateInputValue } from '../utils/dateUtils'
import './PassportApplicationForm.css'

const APPLICATION_TYPES = {
  FIRST_TIME: 'first_time',
  RENEWAL: 'renewal',
  RENEWAL_LOST: 'renewal_lost',
}

const PASSPORT_OPTIONS = [
  { value: '5_year', label: '5 year passport' },
  { value: '10_year', label: '10 year passport' },
]

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const emptySectionErrors = {
  application: [],
  personal: [],
  passport: [],
  documents: [],
}

const sectionErrorLabels = {
  firstName: 'First name is required.',
  lastName: 'Last name is required.',
  fatherName: 'Father name is required.',
  motherName: 'Mother name is required.',
  phone: 'Phone number is required.',
  dateOfBirth: 'Date of birth is required.',
  placeOfBirth: 'Place of birth is required.',
  gender: 'Gender is required.',
  nationality: 'Nationality is required.',
  nationalIdNumber: 'National ID number is required.',
  address: 'Address is required.',
  passportType: 'Passport type is required.',
  passportNumber: 'Passport number is required for renewal.',
  canNumber: 'CAN is required.',
  registryPlace: 'Registry place is required.',
  registryNumber: 'Registry number is required.',
  profession: 'Profession is required.',
  issuanceDate: 'Issuance date is required for renewal.',
  expiryDate: 'Expiry date must be valid and after issuance date.',
  photoId: 'Photo ID is required.',
  oldPassport: 'Old passport scan is required for renewal.',
  replacementDocument: 'Replacement document is optional for lost passport renewal.',
}

const buildSectionErrors = (errors) => {
  const nextSectionErrors = {
    ...emptySectionErrors,
    application: errors.passportType ? [sectionErrorLabels.passportType] : [],
  }
  const personalFields = [
    'firstName',
    'lastName',
    'fatherName',
    'motherName',
    'phone',
    'dateOfBirth',
    'placeOfBirth',
    'gender',
    'nationality',
    'nationalIdNumber',
    'address',
  ]
  const passportFields = [
    'passportNumber',
    'canNumber',
    'registryPlace',
    'registryNumber',
    'profession',
    'issuanceDate',
    'expiryDate',
  ]
  const documentFields = ['photoId', 'oldPassport', 'replacementDocument']

  personalFields.forEach((field) => {
    if (errors[field]) nextSectionErrors.personal.push(sectionErrorLabels[field] || errors[field])
  })
  passportFields.forEach((field) => {
    if (errors[field]) nextSectionErrors.passport.push(sectionErrorLabels[field] || errors[field])
  })
  documentFields.forEach((field) => {
    if (errors[field]) nextSectionErrors.documents.push(sectionErrorLabels[field] || errors[field])
  })

  return nextSectionErrors
}

const PassportApplicationForm = ({ token, currentUser, onUserUpdate }) => {
  const accountEmail = currentUser?.email || ''
  const [applicationType, setApplicationType] = useState(APPLICATION_TYPES.FIRST_TIME)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    fatherName: '',
    motherName: '',
    phone: '',
    dateOfBirth: '',
    placeOfBirth: '',
    gender: '',
    nationality: '',
    nationalIdNumber: '',
    address: '',
    passportType: '',
    passportNumber: '',
    canNumber: '',
    registryPlace: '',
    registryNumber: '',
    profession: '',
    issuanceDate: '',
    expiryDate: '',
  })
  const [files, setFiles] = useState({})
  const [errors, setErrors] = useState({})
  const [sectionErrors, setSectionErrors] = useState(emptySectionErrors)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionResult, setSubmissionResult] = useState(null)
  const [submissionError, setSubmissionError] = useState('')
  const [applicationLock, setApplicationLock] = useState(null)
  const isApplicantVerified =
    !token || currentUser?.role !== 'applicant' || currentUser?.verification_status === 'verified'
  const applicantAge = useMemo(() => {
    if (!formData.dateOfBirth) {
      return null
    }

    const birthDate = new Date(formData.dateOfBirth)
    const today = new Date()

    if (Number.isNaN(birthDate.getTime())) {
      return null
    }

    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDifference = today.getMonth() - birthDate.getMonth()

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1
    }

    return age
  }, [formData.dateOfBirth])
  const passportOptions = useMemo(
    () => (applicantAge !== null && applicantAge < 18 ? PASSPORT_OPTIONS.slice(0, 1) : PASSPORT_OPTIONS),
    [applicantAge]
  )

  useEffect(() => {
    if (!token || currentUser?.role !== 'applicant') {
      setApplicationLock(null)
      return
    }

    let isMounted = true

    const loadApplicationLock = async () => {
      try {
        const response = await getApplications(token)
        const userApplications = response.data || []
        const activeApplication = userApplications.find((application) =>
          ['pending_ai_review', 'ai_verified'].includes(application.status)
        )

        if (activeApplication) {
          if (isMounted) {
            setApplicationLock(
              `You already have an active passport application (${activeApplication.application_reference}).`
            )
          }
          return
        }

        const submittedToday = userApplications.filter((application) => {
          const submittedAt = new Date(application.application_date)
          return Date.now() - submittedAt.getTime() < 24 * 60 * 60 * 1000
        }).length

        if (submittedToday >= 2) {
          if (isMounted) {
            setApplicationLock('You can submit at most two passport applications per day.')
          }
          return
        }

        const latestApplication = userApplications[0]
        if (latestApplication?.application_date) {
          const submittedAt = new Date(latestApplication.application_date)
          const nextAllowedAt = new Date(submittedAt.getTime() + 7 * 24 * 60 * 60 * 1000)

          if (nextAllowedAt > new Date()) {
            if (isMounted) {
              setApplicationLock(
                `You can submit another passport application after ${toDateInputValue(nextAllowedAt)}.`
              )
            }
            return
          }
        }

        if (isMounted) {
          setApplicationLock(null)
        }
      } catch {
        if (isMounted) {
          setApplicationLock(null)
        }
      }
    }

    loadApplicationLock()

    return () => {
      isMounted = false
    }
  }, [token, currentUser?.role])

  useEffect(() => {
    if (currentUser?.role !== 'applicant') {
      return
    }

    setFormData((previousData) => ({
      ...previousData,
      firstName: previousData.firstName || currentUser.first_name || '',
      lastName: previousData.lastName || currentUser.last_name || '',
      fatherName: previousData.fatherName || currentUser.father_name || '',
      motherName: previousData.motherName || currentUser.mother_name || '',
      phone: previousData.phone || currentUser.phone || '',
      dateOfBirth: previousData.dateOfBirth || toDateInputValue(currentUser.date_of_birth),
      gender: previousData.gender || currentUser.gender || '',
      nationalIdNumber: previousData.nationalIdNumber || currentUser.national_id_number || '',
    }))
  }, [currentUser])

  const selectedPassport = useMemo(
    () => passportOptions.find((option) => option.value === formData.passportType),
    [formData.passportType, passportOptions]
  )

  useEffect(() => {
    if (formData.passportType && !passportOptions.some((option) => option.value === formData.passportType)) {
      updateField('passportType', passportOptions[0]?.value || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportOptions, formData.passportType])

  useEffect(() => {
    if (applicationType !== APPLICATION_TYPES.RENEWAL && (
      formData.passportNumber ||
      formData.canNumber ||
      formData.registryPlace ||
      formData.profession ||
      formData.issuanceDate ||
      formData.expiryDate
    )) {
      setFormData((previousData) => ({
        ...previousData,
        passportNumber: '',
        canNumber: '',
        registryPlace: '',
        profession: '',
        issuanceDate: '',
        expiryDate: '',
      }))
    }
  }, [
    applicationType,
    formData.passportNumber,
    formData.canNumber,
    formData.registryPlace,
    formData.profession,
    formData.issuanceDate,
    formData.expiryDate,
  ])

  const isStandardRenewalApplication = applicationType === APPLICATION_TYPES.RENEWAL

  const updateApplicationType = (nextType) => {
    setApplicationType(nextType)
    setErrors((previousErrors) => ({
      ...previousErrors,
      passportNumber: null,
      issuanceDate: null,
      expiryDate: null,
    }))
    setSectionErrors((previousErrors) => ({ ...previousErrors, application: [] }))
  }

  const updateField = (field, value) => {
    setFormData((previousData) => ({ ...previousData, [field]: value }))

    if (errors[field]) {
      setErrors((previousErrors) => ({ ...previousErrors, [field]: null }))
    }
    setSectionErrors(emptySectionErrors)
  }

  const handleFileChange = (name, event) => {
    const file = event.target.files?.[0]
    setFiles((previousFiles) => ({ ...previousFiles, [name]: file }))

    if (errors[name]) {
      setErrors((previousErrors) => ({ ...previousErrors, [name]: null }))
    }
    setSectionErrors(emptySectionErrors)
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.firstName.trim()) nextErrors.firstName = 'First name is required'
    if (!formData.lastName.trim()) nextErrors.lastName = 'Last name is required'
    if (!formData.fatherName.trim()) nextErrors.fatherName = 'Father name is required'
    if (!formData.motherName.trim()) nextErrors.motherName = 'Mother name is required'
    if (!formData.phone.trim()) nextErrors.phone = 'Phone number is required'
    if (!formData.dateOfBirth) nextErrors.dateOfBirth = 'Date of birth is required'
    if (!formData.placeOfBirth.trim()) nextErrors.placeOfBirth = 'Place of birth is required'
    if (!formData.gender) nextErrors.gender = 'Gender is required'
    if (!formData.nationality.trim()) nextErrors.nationality = 'Nationality is required'
    if (!formData.nationalIdNumber.trim()) nextErrors.nationalIdNumber = 'National ID number is required'
    if (!formData.address.trim()) nextErrors.address = 'Address is required'
    if (!formData.passportType) nextErrors.passportType = 'Passport type is required'
    if (!formData.registryNumber.trim()) nextErrors.registryNumber = 'Registry number is required'

    if (isStandardRenewalApplication) {
      if (!formData.passportNumber.trim()) nextErrors.passportNumber = 'Passport number is required for renewal'
      if (!formData.canNumber.trim()) nextErrors.canNumber = 'CAN is required'
      if (!formData.registryPlace.trim()) nextErrors.registryPlace = 'Registry place is required'
      if (!formData.issuanceDate) nextErrors.issuanceDate = 'Issuance date is required for renewal'
      if (!formData.expiryDate) nextErrors.expiryDate = 'Expiry date is required for renewal'
    }

    if (
      formData.issuanceDate &&
      formData.expiryDate &&
      new Date(formData.expiryDate) <= new Date(formData.issuanceDate)
    ) {
      nextErrors.expiryDate = 'Expiry date must be after issuance date'
    }

    if (!files.photoId) nextErrors.photoId = 'Photo ID is required'

    if (applicationType === APPLICATION_TYPES.RENEWAL && !files.oldPassport) {
      nextErrors.oldPassport = 'Old passport scan is required for renewal'
    }

    setErrors(nextErrors)
    setSectionErrors(buildSectionErrors(nextErrors))
    return Object.keys(nextErrors).length === 0
  }

  const buildApplicationNotes = () => {
    const typeLabelMap = {
      [APPLICATION_TYPES.FIRST_TIME]: 'First-time application',
      [APPLICATION_TYPES.RENEWAL]: 'Renewal application',
      [APPLICATION_TYPES.RENEWAL_LOST]: 'Renewal due to lost passport',
    }

    return `${typeLabelMap[applicationType]} submitted from frontend form`
  }

  const buildDocumentPayloads = (applicationId) => {
    const documents = [
      {
        file: files.photoId,
        document_type: 'photo_id',
      },
    ]

    if (files.oldPassport) {
      documents.push({
        file: files.oldPassport,
        document_type: 'old_passport_copy',
      })
    }

    if (files.replacementDocument) {
      documents.push({
        file: files.replacementDocument,
        document_type: 'replacement_document',
      })
    }

    return documents
      .filter((document) => document.file)
      .map((document) => {
        const payload = new FormData()
        payload.append('document_type', document.document_type)
        payload.append('verification_status', 'pending')
        payload.append('file', document.file)

        return {
          applicationId,
          payload,
        }
      })
  }

  const resetForm = () => {
    setApplicationType(APPLICATION_TYPES.FIRST_TIME)
    setFormData({
      firstName: currentUser?.role === 'applicant' ? currentUser.first_name || '' : '',
      lastName: currentUser?.role === 'applicant' ? currentUser.last_name || '' : '',
      fatherName: currentUser?.role === 'applicant' ? currentUser.father_name || '' : '',
      motherName: currentUser?.role === 'applicant' ? currentUser.mother_name || '' : '',
      phone: currentUser?.role === 'applicant' ? currentUser.phone || '' : '',
      dateOfBirth: currentUser?.role === 'applicant' ? toDateInputValue(currentUser.date_of_birth) : '',
      placeOfBirth: '',
      gender: currentUser?.role === 'applicant' ? currentUser.gender || '' : '',
      nationality: '',
      nationalIdNumber: currentUser?.role === 'applicant' ? currentUser.national_id_number || '' : '',
      address: '',
      passportType: '',
      passportNumber: '',
      canNumber: '',
      registryPlace: '',
      registryNumber: '',
      profession: '',
      issuanceDate: '',
      expiryDate: '',
    })
    setFiles({})
    setErrors({})
    setSectionErrors(emptySectionErrors)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmissionError('')
    setSubmissionResult(null)
    setSectionErrors(emptySectionErrors)

    if (!token) {
      setSubmissionError('You must log in before submitting an application.')
      return
    }

    if (!isApplicantVerified) {
      setSubmissionError('Your account must be verified before you can submit a passport application.')
      return
    }

    if (applicationLock) {
      setSubmissionError(applicationLock)
      return
    }

    if (!validate()) {
      return
    }

    setIsSubmitting(true)

    try {
      let applicantId = currentUser?.applicant_id || null

      if (!applicantId) {
        const applicantResponse = await createApplicant(
          {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            father_name: formData.fatherName.trim(),
            mother_name: formData.motherName.trim(),
            date_of_birth: formData.dateOfBirth,
            place_of_birth: formData.placeOfBirth.trim(),
            gender: formData.gender,
            nationality: formData.nationality.trim(),
            national_id_number: formData.nationalIdNumber.trim(),
            phone: formData.phone.trim(),
            email: accountEmail,
            address: formData.address.trim(),
          },
          token
        )

        applicantId = applicantResponse.data.applicant_id

        if (onUserUpdate && currentUser) {
          onUserUpdate({
            ...currentUser,
            applicant_id: applicantId,
          })
        }
      }

      const applicationResponse = await createPassportApplication(
        {
          applicant_id: applicantId,
          application_type: applicationType,
          passport_type: formData.passportType,
          passport_number: isStandardRenewalApplication ? formData.passportNumber.trim() : null,
          can_number: isStandardRenewalApplication ? formData.canNumber.trim() : null,
          registry_place: isStandardRenewalApplication ? formData.registryPlace.trim() : null,
          registry_number: formData.registryNumber.trim(),
          profession: isStandardRenewalApplication ? formData.profession.trim() : null,
          issuance_date: isStandardRenewalApplication ? formData.issuanceDate || null : null,
          expiry_date: isStandardRenewalApplication ? formData.expiryDate || null : null,
          notes: buildApplicationNotes(),
        },
        token
      )

      const documentPayloads = buildDocumentPayloads(applicationResponse.data.application_id)

      for (const documentPayload of documentPayloads) {
        await addApplicationDocument(documentPayload.applicationId, documentPayload.payload, token)
      }

      const finalAiReview = await runApplicationAiReview(applicationResponse.data.application_id, token)

      setSubmissionResult({
        applicantId,
        applicationId: applicationResponse.data.application_id,
        status: finalAiReview?.data?.status || applicationResponse.data.status,
      })
      setApplicationLock(
        `You already have an active passport application (${applicationResponse.data.application_reference}).`
      )
      resetForm()
    } catch (error) {
      setSubmissionError(error.message || 'Failed to submit the application')
    } finally {
      setIsSubmitting(false)
    }
  }

  const showOldPassport = applicationType === APPLICATION_TYPES.RENEWAL
  const showReplacement = applicationType === APPLICATION_TYPES.RENEWAL_LOST

  const FileUploadField = ({ name, label, instruction, required = true }) => (
    <Form.Group className="mb-4">
      <Form.Label>
        {label} {required && <span className="text-danger">*</span>}
      </Form.Label>
      {instruction && <p className="text-muted small mb-2">{instruction}</p>}
      <div className={`ps-file-upload border rounded p-3 ${errors[name] ? 'ps-file-upload-invalid' : ''}`}>
        <input
          id={`file-upload-${name}`}
          type="file"
          accept="image/*,.pdf"
          className="ps-file-input"
          onChange={(event) => handleFileChange(name, event)}
        />
        <label htmlFor={`file-upload-${name}`} className="ps-file-upload-trigger btn btn-outline-primary mb-0">
          Choose File
        </label>
        <div className={`ps-file-upload-name ${files[name] ? 'has-file' : ''}`}>
          {files[name] ? files[name].name : 'No file selected'}
        </div>
      </div>
      {errors[name] && <div className="invalid-feedback d-block">{errors[name]}</div>}
    </Form.Group>
  )

  const SectionErrorBlock = ({ errors }) =>
    errors.length ? (
      <Alert variant="danger" className="ps-application-section-alert">
        <ul className="mb-0">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </Alert>
    ) : null

  return (
    <Form onSubmit={handleSubmit}>
      {submissionResult && (
        <Alert variant="success">
          <h5 className="mb-2">Application Submitted Successfully</h5>
          <p className="mb-1">Applicant ID: {submissionResult.applicantId}</p>
          <p className="mb-1">Application ID: {submissionResult.applicationId}</p>
          <p className="mb-0">Current Status: {submissionResult.status}</p>
        </Alert>
      )}

      {submissionError && (
        <Alert variant="danger">
          {submissionError}
        </Alert>
      )}

      {applicationLock && (
        <Alert variant="warning">
          {applicationLock}
        </Alert>
      )}

      <Card className="ps-application-card mb-4">
        <Card.Header className="ps-application-card-header">
          <h5 className="mb-0">Application Type</h5>
        </Card.Header>
        <Card.Body>
          <SectionErrorBlock errors={sectionErrors.application} />
          <Form.Group className="ps-application-type-options">
            <Form.Check
              type="radio"
              id="first_time"
              name="applicationType"
              label="First time - applying for passport for the first time"
              checked={applicationType === APPLICATION_TYPES.FIRST_TIME}
              onChange={() => updateApplicationType(APPLICATION_TYPES.FIRST_TIME)}
            />
            <Form.Check
              type="radio"
              id="renewal"
              name="applicationType"
              label="Renewal - renewing an existing passport"
              checked={applicationType === APPLICATION_TYPES.RENEWAL}
              onChange={() => updateApplicationType(APPLICATION_TYPES.RENEWAL)}
            />
            <Form.Check
              type="radio"
              id="renewal_lost"
              name="applicationType"
              label="Renewal - old passport was lost"
              checked={applicationType === APPLICATION_TYPES.RENEWAL_LOST}
              onChange={() => updateApplicationType(APPLICATION_TYPES.RENEWAL_LOST)}
            />
          </Form.Group>
        </Card.Body>
      </Card>

      <Card className="ps-application-card mb-4">
        <Card.Header className="ps-application-card-header">
          <h5 className="mb-0">Personal Information</h5>
        </Card.Header>
        <Card.Body>
          <SectionErrorBlock errors={sectionErrors.personal} />
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>First Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  value={formData.firstName}
                  onChange={(event) => updateField('firstName', event.target.value)}
                  isInvalid={!!errors.firstName}
                />
                <Form.Control.Feedback type="invalid">{errors.firstName}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Last Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  value={formData.lastName}
                  onChange={(event) => updateField('lastName', event.target.value)}
                  isInvalid={!!errors.lastName}
                />
                <Form.Control.Feedback type="invalid">{errors.lastName}</Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Father Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  value={formData.fatherName}
                  onChange={(event) => updateField('fatherName', event.target.value)}
                  isInvalid={!!errors.fatherName}
                />
                <Form.Control.Feedback type="invalid">{errors.fatherName}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Mother Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  value={formData.motherName}
                  onChange={(event) => updateField('motherName', event.target.value)}
                  isInvalid={!!errors.motherName}
                />
                <Form.Control.Feedback type="invalid">{errors.motherName}</Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={12}>
              <Form.Group className="mb-3">
                <Form.Label>Phone <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  value={formData.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  isInvalid={!!errors.phone}
                />
                <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Date of Birth <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(event) => updateField('dateOfBirth', event.target.value)}
                  isInvalid={!!errors.dateOfBirth}
                />
                <Form.Control.Feedback type="invalid">{errors.dateOfBirth}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Place of Birth <span className="text-danger">*</span></Form.Label>
                <Form.Select
                  value={formData.placeOfBirth}
                  onChange={(event) => updateField('placeOfBirth', event.target.value)}
                  isInvalid={!!errors.placeOfBirth}
                >
                  <option value="">Select place of birth</option>
                  {LEBANESE_VILLAGE_OPTIONS.map((village) => (
                    <option key={village} value={village}>{village}</option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errors.placeOfBirth}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Gender <span className="text-danger">*</span></Form.Label>
                <Form.Select
                  value={formData.gender}
                  onChange={(event) => updateField('gender', event.target.value)}
                  isInvalid={!!errors.gender}
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errors.gender}</Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nationality <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  value={formData.nationality}
                  onChange={(event) => updateField('nationality', event.target.value)}
                  isInvalid={!!errors.nationality}
                />
                <Form.Control.Feedback type="invalid">{errors.nationality}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>National ID Number <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  value={formData.nationalIdNumber}
                  onChange={(event) => updateField('nationalIdNumber', event.target.value)}
                  isInvalid={!!errors.nationalIdNumber}
                />
                <Form.Control.Feedback type="invalid">{errors.nationalIdNumber}</Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Address <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              value={formData.address}
              onChange={(event) => updateField('address', event.target.value)}
              isInvalid={!!errors.address}
            />
            <Form.Control.Feedback type="invalid">{errors.address}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-0">
            <Form.Label>Passport Type <span className="text-danger">*</span></Form.Label>
            <Form.Select
              value={formData.passportType}
              onChange={(event) => updateField('passportType', event.target.value)}
              isInvalid={!!errors.passportType}
            >
              <option value="">Select passport type</option>
              {passportOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
            {selectedPassport && (
              <Form.Text className="text-muted">
                Selected: {selectedPassport.label}
                {applicantAge !== null && applicantAge < 18 ? ' - under 18 applicants can only apply for this duration.' : ''}
              </Form.Text>
            )}
            <Form.Control.Feedback type="invalid">{errors.passportType}</Form.Control.Feedback>
          </Form.Group>
        </Card.Body>
      </Card>

      <Card className="ps-application-card mb-4">
        <Card.Header className="ps-application-card-header">
          <h5 className="mb-0">
            {isStandardRenewalApplication ? 'Passport and Registry Details' : 'Registry Details'}
          </h5>
        </Card.Header>
        <Card.Body>
          <SectionErrorBlock errors={sectionErrors.passport} />
          <Row>
            {isStandardRenewalApplication && (
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Passport Number <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.passportNumber}
                    onChange={(event) => updateField('passportNumber', event.target.value)}
                    isInvalid={!!errors.passportNumber}
                  />
                  <Form.Control.Feedback type="invalid">{errors.passportNumber}</Form.Control.Feedback>
                </Form.Group>
              </Col>
            )}
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Registry Number <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  value={formData.registryNumber}
                  onChange={(event) => updateField('registryNumber', event.target.value)}
                  isInvalid={!!errors.registryNumber}
                />
                <Form.Control.Feedback type="invalid">{errors.registryNumber}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            {isStandardRenewalApplication && (
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>CAN <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.canNumber}
                    onChange={(event) => updateField('canNumber', event.target.value)}
                    isInvalid={!!errors.canNumber}
                  />
                  <Form.Control.Feedback type="invalid">{errors.canNumber}</Form.Control.Feedback>
                </Form.Group>
              </Col>
            )}
          </Row>

          {isStandardRenewalApplication && (
          <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Registry Place <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.registryPlace}
                    onChange={(event) => updateField('registryPlace', event.target.value)}
                    isInvalid={!!errors.registryPlace}
                  />
                  <Form.Control.Feedback type="invalid">{errors.registryPlace}</Form.Control.Feedback>
                </Form.Group>
              </Col>
            <Col md={4}>
              <Form.Group className="mb-3 mb-md-0">
                <Form.Label>Profession</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.profession}
                  onChange={(event) => updateField('profession', event.target.value)}
                  isInvalid={!!errors.profession}
                />
                <Form.Control.Feedback type="invalid">{errors.profession}</Form.Control.Feedback>
              </Form.Group>
            </Col>
              <>
                <Col md={4}>
              <Form.Group className="mb-3 mb-md-0">
                <Form.Label>
                  Issuance Date <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  value={formData.issuanceDate}
                  onChange={(event) => updateField('issuanceDate', event.target.value)}
                  isInvalid={!!errors.issuanceDate}
                />
                <Form.Control.Feedback type="invalid">{errors.issuanceDate}</Form.Control.Feedback>
              </Form.Group>
                </Col>
                <Col md={4}>
              <Form.Group className="mb-0">
                <Form.Label>
                  Expiry Date <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  value={formData.expiryDate}
                  onChange={(event) => updateField('expiryDate', event.target.value)}
                  isInvalid={!!errors.expiryDate}
                />
                <Form.Control.Feedback type="invalid">{errors.expiryDate}</Form.Control.Feedback>
              </Form.Group>
                </Col>
              </>
          </Row>
          )}
        </Card.Body>
      </Card>

      <Card className="ps-application-card mb-4">
        <Card.Header className="ps-application-card-header">
          <h5 className="mb-0">Required Documents</h5>
        </Card.Header>
        <Card.Body>
          <SectionErrorBlock errors={sectionErrors.documents} />
          <FileUploadField
            name="photoId"
            label="Photo ID"
            instruction="Upload a clear passport-style photo with a plain white background."
          />

          {showOldPassport && (
            <FileUploadField
              name="oldPassport"
              label="Old Passport"
              instruction="Required when renewing an existing passport."
            />
          )}

          {showReplacement && (
            <FileUploadField
              name="replacementDocument"
              label="Replacement Document for Lost Passport"
              instruction="Optional. If an official replacement document is not available, the application can continue normally for now, but staff may request it later."
            />
          )}
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 justify-content-end">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isSubmitting || !token || !isApplicantVerified || !!applicationLock}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Request'}
        </Button>
      </div>
    </Form>
  )
}

export default PassportApplicationForm

import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Container, Form, InputGroup, Modal, Row, Table } from 'react-bootstrap'
import { Link, Navigate } from 'react-router-dom'
import {
  cancelApplication,
  decideAccountVerificationReview,
  getAccountVerificationReviewById,
  getAccountVerificationReviews,
  getApplicationById,
  getApplications,
  runApplicationAiReview,
  updateApplicationStatus,
} from '../services/passportService'
import { formatDisplayDate } from '../utils/dateUtils'
import './OperationsPage.css'

const formatDate = (value) => {
  if (!value) {
    return 'Not available'
  }

  return formatDisplayDate(value)
}

const formatStatus = (status) =>
  (status || 'pending')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

const formatReviewValue = (value) => {
  if (!value) {
    return 'Not available'
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
    return formatDate(value)
  }

  return formatStatus(String(value))
}

const ReviewExtractedValue = ({ value, rawValue }) => (
  <div>
    <div>{formatReviewValue(value)}</div>
    {rawValue && (
      <div className="ps-review-raw-arabic" lang="ar" dir="rtl">
        {rawValue}
      </div>
    )}
  </div>
)

const normalizeReviewComparisonValue = (value) => {
  if (!value) {
    return ''
  }

  const textValue = String(value).trim().toLowerCase()

  if (/^\d{4}-\d{2}-\d{2}/.test(textValue)) {
    return textValue.slice(0, 10)
  }

  return textValue.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

const normalizeNameForReview = (value) =>
  normalizeReviewComparisonValue(value)
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const phoneticReviewName = (value) =>
  normalizeNameForReview(value)
    .replace(/ou/g, 'u')
    .replace(/oo/g, 'u')
    .replace(/ee/g, 'i')
    .replace(/ei/g, 'i')
    .replace(/ai/g, 'ay')
    .replace(/mm/g, 'm')
    .replace(/ss/g, 's')
    .replace(/tt/g, 't')
    .replace(/zai/g, 'zay')
    .replace(/[aeiou\s]/g, '')

const normalizeLocationForReview = (value) =>
  normalizeNameForReview(value)
    .replace(/\bal\b/g, '')
    .replace(/\bel\b/g, '')
    .replace(/\bthe\b/g, '')
    .replace(/kafar/g, 'kfar')
    .replace(/kfer/g, 'kfar')
    .replace(/tibneet/g, 'tibnit')
    .replace(/tibneit/g, 'tibnit')
    .replace(/nabatiyeh/g, 'nabatieh')
    .replace(/nabatiye/g, 'nabatieh')
    .replace(/\s+/g, '')

const editDistance = (left, right) => {
  if (left === right) return 0
  if (!left || !right) return Math.max(left.length, right.length)

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + cost
      )
    }

    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

const namesMatch = (providedValue, extractedValue, field) => {
  const providedName = normalizeNameForReview(providedValue)
  const extractedName = normalizeNameForReview(extractedValue)

  if (!providedName || !extractedName) return false

  const providedParts = providedName.split(' ').filter(Boolean)
  const extractedParts = extractedName.split(' ').filter(Boolean)
  const providedComparable = field === 'father_name' ? providedParts[0] || providedName : providedName
  const extractedComparable = field === 'father_name' ? extractedParts[0] || extractedName : extractedName

  if (providedComparable === extractedComparable) return true

  const maxDistance = Math.max(providedComparable.length, extractedComparable.length) >= 7 ? 2 : 1
  if (editDistance(providedComparable, extractedComparable) <= maxDistance) return true

  const providedPhonetic = phoneticReviewName(providedComparable)
  const extractedPhonetic = phoneticReviewName(extractedComparable)

  return Boolean(providedPhonetic && extractedPhonetic && editDistance(providedPhonetic, extractedPhonetic) <= 1)
}

const locationValuesMatch = (providedValue, extractedValue) => {
  const providedLocation = normalizeLocationForReview(providedValue)
  const extractedLocation = normalizeLocationForReview(extractedValue)

  if (!providedLocation || !extractedLocation) return false
  if (providedLocation === extractedLocation) return true
  if (providedLocation.includes(extractedLocation) || extractedLocation.includes(providedLocation)) return true

  const maxDistance = Math.max(providedLocation.length, extractedLocation.length) >= 9 ? 3 : 2
  if (editDistance(providedLocation, extractedLocation) <= maxDistance) return true

  const providedPhonetic = phoneticReviewName(providedLocation)
  const extractedPhonetic = phoneticReviewName(extractedLocation)

  return Boolean(providedPhonetic && extractedPhonetic && editDistance(providedPhonetic, extractedPhonetic) <= 2)
}

const normalizeNumericReviewValue = (value) => String(value || '').replace(/\D/g, '').replace(/^0+/, '')

const reviewValuesMatch = (providedValue, extractedValue, field) => {
  const provided = normalizeReviewComparisonValue(providedValue)
  const extracted = normalizeReviewComparisonValue(extractedValue)

  if (field?.endsWith('_name')) {
    return namesMatch(providedValue, extractedValue, field)
  }

  if (field === 'place_of_birth') {
    return locationValuesMatch(providedValue, extractedValue)
  }

  if (field === 'national_id_number' || field === 'registry_number') {
    return Boolean(
      normalizeNumericReviewValue(providedValue) &&
        normalizeNumericReviewValue(providedValue) === normalizeNumericReviewValue(extractedValue)
    )
  }

  return provided === extracted
}

const reviewHasMismatchedValues = (review) =>
  reviewFieldRows.some(([field]) => !reviewValuesMatch(review?.[field], review?.extracted_data?.[field], field))

const reviewFieldRows = [
  ['first_name', 'First Name'],
  ['last_name', 'Last Name'],
  ['father_name', 'Father Name'],
  ['mother_name', 'Mother Name'],
  ['date_of_birth', 'Date of Birth'],
  ['place_of_birth', 'Place of Birth'],
  ['national_id_number', 'National ID Number'],
  ['gender', 'Gender'],
  ['governorate', 'Governorate'],
  ['blood_type', 'Blood Type'],
  ['marital_status', 'Marital Status'],
  ['registry_number', 'Registry Number'],
]

const passportReviewFieldRows = [
  ['first_name', 'First Name', 'first_name'],
  ['last_name', 'Last Name', 'last_name'],
  ['father_name', 'Father Name', 'father_name'],
  ['mother_name', 'Mother Name', 'mother_name'],
  ['date_of_birth', 'Date of Birth', 'date_of_birth'],
  ['place_of_birth', 'Place of Birth', 'place_of_birth'],
  ['gender', 'Gender', 'gender'],
  ['passport_number', 'Passport Number', 'passport_number'],
  ['can_number', 'CAN', 'can_number'],
  ['registry_number', 'Registry Number', 'registry_number'],
  ['issuance_date', 'Issuance Date', 'issuance_date'],
  ['expiry_date', 'Expiry Date', 'expiry_date'],
]

const getPassportProvidedValue = (application, field) => {
  const aliases = {
    first_name: application?.first_name,
    last_name: application?.last_name,
    father_name: application?.father_name,
    mother_name: application?.mother_name,
    date_of_birth: application?.date_of_birth,
    place_of_birth: application?.place_of_birth,
    gender: application?.gender,
  }

  return aliases[field] ?? application?.[field]
}

const getPassportComparisonRows = (application) => {
  const rows = application?.ai_extracted_data?._comparison_rows

  if (Array.isArray(rows) && rows.length) {
    return rows.map((row) => ({
      ...row,
      ...(row.field === 'national_id_number'
        ? {
            actual:
              application?.ai_extracted_data?._national_id_data?.national_id_number ||
              application?.ai_extracted_data?._national_id_data?.nationalIdNumber ||
              application?.ai_extracted_data?._national_id_data?.id_number ||
              application?.ai_extracted_data?._national_id_data?.idNumber ||
              row.actual,
            actual_source: 'Latest ID Verification',
          }
        : {}),
    })).map((row) => ({
      ...row,
      match: row.match || reviewValuesMatch(row.expected, row.actual, row.field),
    }))
  }

  return passportReviewFieldRows.map(([field, label, extractedField]) => {
    const providedValue = getPassportProvidedValue(application, field)
    const extractedValue = application?.ai_extracted_data?.[extractedField]

    return {
      field,
      label,
      expected: providedValue,
      actual: extractedValue,
      expected_source: 'User Provided',
      actual_source: 'AI Extracted',
      match: reviewValuesMatch(providedValue, extractedValue, field),
    }
  })
}

const passportReviewHasMismatchedValues = (application) =>
  getPassportComparisonRows(application).some((row) => !row.match)

const reviewStatusLabel = (status) => (status ? formatStatus(status) : 'All statuses')

const buildPrefixedId = (prefix, value) => {
  const normalizedValue = String(value || '').trim().toUpperCase()

  if (!normalizedValue) {
    return ''
  }

  return normalizedValue.startsWith(prefix) ? normalizedValue : `${prefix}${normalizedValue}`
}

const cleanVerificationCodeBody = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/^AV-/i, '')
    .replace(/[^0-9-]/g, '')
    .slice(0, 11)

const cleanApplicationReferenceNumber = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/^PS-APP-/i, '')
    .replace(/[^0-9-]/g, '')
    .slice(0, 12)

const formatExtractionMethod = (extractedData = {}) => {
  if (extractedData._verification_agent === 'gemini') {
    return `Gemini agent${extractedData._verification_agent_model ? ` (${extractedData._verification_agent_model})` : ''}`
  }

  if (extractedData._ocr_provider === 'gemini') {
    return `Gemini OCR${extractedData._ocr_model ? ` (${extractedData._ocr_model})` : ''}`
  }

  return 'Python OCR'
}

const staffVisibleStatuses = [
  'pending_ai_review',
  'ai_verified',
  'ai_rejected',
  'cancelled_by_staff',
  'issued',
]

const OperationsPage = ({ token, currentUser }) => {
  const [applications, setApplications] = useState([])
  const [accountReviews, setAccountReviews] = useState([])
  const [selectedAccountReviewId, setSelectedAccountReviewId] = useState(null)
  const [selectedAccountReview, setSelectedAccountReview] = useState(null)
  const [reviewStatusFilter, setReviewStatusFilter] = useState('under_review')
  const [reviewCodeBody, setReviewCodeBody] = useState('')
  const [selectedApplicationId, setSelectedApplicationId] = useState(null)
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [applicationReferenceNumber, setApplicationReferenceNumber] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingReviews, setIsLoadingReviews] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isLoadingReviewDetails, setIsLoadingReviewDetails] = useState(false)
  const [pageError, setPageError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSection, setActionSection] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')
  const [reviewDecisionNotes, setReviewDecisionNotes] = useState('')
  const [applicationDecisionNotes, setApplicationDecisionNotes] = useState('')
  const [previewImage, setPreviewImage] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isRunningApplicationAi, setIsRunningApplicationAi] = useState(false)
  const [activeApplicationDecision, setActiveApplicationDecision] = useState('')
  const [activeReviewDecision, setActiveReviewDecision] = useState('')

  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'officer'

  const getAccountReviewFilters = () => ({
    status: reviewStatusFilter,
    verificationCode: buildPrefixedId('AV-', reviewCodeBody),
  })

  const getApplicationFilters = () => ({
    search: buildPrefixedId('PS-APP-', applicationReferenceNumber),
    status: statusFilter,
  })

  const loadAccountReviews = async (filters = {}) => {
    const response = await getAccountVerificationReviews(token, filters)
    setAccountReviews(response.data || [])

    if (!selectedAccountReviewId && response.data?.length) {
      setSelectedAccountReviewId(response.data[0].account_verification_id)
    }

    if (
      selectedAccountReviewId &&
      !response.data?.some((review) => review.account_verification_id === selectedAccountReviewId)
    ) {
      setSelectedAccountReviewId(response.data?.[0]?.account_verification_id || null)
      setSelectedAccountReview(null)
    }
  }

  const loadApplications = async (filters = {}) => {
    const applicationResponse = await getApplications(token, filters)
    setApplications(applicationResponse.data || [])

    if (!selectedApplicationId && applicationResponse.data?.length) {
      setSelectedApplicationId(applicationResponse.data[0].application_id)
    }

    if (
      selectedApplicationId &&
      !applicationResponse.data?.some((application) => application.application_id === selectedApplicationId)
    ) {
      setSelectedApplicationId(applicationResponse.data?.[0]?.application_id || null)
    }
  }

  useEffect(() => {
    if (!token || !isStaff) {
      return
    }

    const loadData = async () => {
      setIsLoading(true)
      setPageError('')

      try {
        await Promise.all([
          loadAccountReviews(getAccountReviewFilters()),
          loadApplications(getApplicationFilters()),
        ])
      } catch (error) {
        setPageError(error.message || 'Failed to load operations data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isStaff])

  useEffect(() => {
    if (!token || !isStaff) {
      return undefined
    }

    const timer = window.setTimeout(async () => {
      setIsLoadingReviews(true)
      setPageError('')

      try {
        await loadAccountReviews(getAccountReviewFilters())
      } catch (error) {
        setPageError(error.message || 'Failed to load account verification reviews')
      } finally {
        setIsLoadingReviews(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isStaff, reviewStatusFilter, reviewCodeBody])

  useEffect(() => {
    if (!token || !isStaff || !selectedAccountReviewId) {
      setSelectedAccountReview(null)
      return
    }

    const loadReviewDetails = async () => {
      setIsLoadingReviewDetails(true)
      setActionError('')

      try {
        const response = await getAccountVerificationReviewById(selectedAccountReviewId, token)
        setSelectedAccountReview(response.data)
      } catch (error) {
        setActionSection('account-review')
        setActionError(error.message || 'Failed to load account verification details')
      } finally {
        setIsLoadingReviewDetails(false)
      }
    }

    loadReviewDetails()
  }, [selectedAccountReviewId, token, isStaff])

  useEffect(() => {
    if (!token || !isStaff) {
      return undefined
    }

    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setPageError('')

      try {
        await loadApplications(getApplicationFilters())
      } catch (error) {
        setPageError(error.message || 'Failed to load passport applications')
      } finally {
        setIsLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isStaff, statusFilter, applicationReferenceNumber])

  useEffect(() => {
    if (!token || !isStaff || !selectedApplicationId) {
      setSelectedApplication(null)
      return
    }

    const loadDetails = async () => {
      setIsLoadingDetails(true)
      setActionError('')

      try {
        const response = await getApplicationById(selectedApplicationId, token)
        setSelectedApplication(response.data)
      } catch (error) {
        setActionSection('passport-application')
        setActionError(error.message || 'Failed to load application details')
      } finally {
        setIsLoadingDetails(false)
      }
    }

    loadDetails()
  }, [selectedApplicationId, token, isStaff])

  if (!token || !currentUser) {
    return <Navigate to="/login" replace state={{ from: '/operations' }} />
  }

  if (!isStaff) {
    return <Navigate to="/account" replace />
  }

  const handleSearchSubmit = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setPageError('')
    setActionMessage('')

    try {
      await loadApplications(getApplicationFilters())
    } catch (error) {
      setPageError(error.message || 'Failed to search applications')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshData = async (nextSelectedId = selectedApplicationId) => {
    await Promise.all([
      loadAccountReviews(getAccountReviewFilters()),
      loadApplications(getApplicationFilters()),
    ])

    if (nextSelectedId) {
      const response = await getApplicationById(nextSelectedId, token)
      setSelectedApplication(response.data)
      setSelectedApplicationId(nextSelectedId)
    }
  }

  const handleReviewDecision = async (decision) => {
    if (!selectedAccountReview) {
      return
    }

    setActiveReviewDecision(decision)
    setActionError('')
    setActionMessage('')
    setActionSection('account-review')

    try {
      const response = await decideAccountVerificationReview(
        selectedAccountReview.account_verification_id,
        {
          decision,
          notes: reviewDecisionNotes.trim() || null,
        },
        token
      )

      setActionMessage(response.message || 'Account verification decision saved.')
      setReviewDecisionNotes('')
      await loadAccountReviews(getAccountReviewFilters())

      const detailResponse = await getAccountVerificationReviewById(
        selectedAccountReview.account_verification_id,
        token
      )
      setSelectedAccountReview(detailResponse.data)
    } catch (error) {
      setActionError(error.message || 'Failed to save account verification decision')
    } finally {
      setActiveReviewDecision('')
    }
  }

  const handleCancelApplication = async () => {
    if (!selectedApplication) {
      return
    }

    setIsCancelling(true)
    setActionError('')
    setActionMessage('')
    setActionSection('passport-application')

    try {
      const response = await cancelApplication(
        selectedApplication.application_id,
        { cancellation_reason: cancellationReason.trim() || null },
        token
      )

      setActionMessage(response.message || 'Application cancelled successfully.')
      setCancellationReason('')
      await refreshData(selectedApplication.application_id)
    } catch (error) {
      setActionError(error.message || 'Failed to cancel application')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleRunApplicationAiReview = async () => {
    if (!selectedApplication) {
      return
    }

    setIsRunningApplicationAi(true)
    setActionError('')
    setActionMessage('')
    setActionSection('passport-application')

    try {
      const response = await runApplicationAiReview(selectedApplication.application_id, token)
      setActionMessage(response.message || 'Application AI verification completed.')
      await refreshData(selectedApplication.application_id)
    } catch (error) {
      setActionError(error.message || 'Failed to run application AI verification')
    } finally {
      setIsRunningApplicationAi(false)
    }
  }

  const handleApplicationDecision = async (decision) => {
    if (!selectedApplication) {
      return
    }

    setActiveApplicationDecision(decision)
    setActionError('')
    setActionMessage('')
    setActionSection('passport-application')

    try {
      const nextStatus = decision === 'accept' ? 'ai_verified' : 'ai_rejected'
      const response = await updateApplicationStatus(
        selectedApplication.application_id,
        {
          status: nextStatus,
          notes: applicationDecisionNotes.trim() || null,
        },
        token
      )

      setActionMessage(response.message || 'Passport application decision saved.')
      setApplicationDecisionNotes('')
      await refreshData(selectedApplication.application_id)
    } catch (error) {
      setActionError(error.message || 'Failed to save passport application decision')
    } finally {
      setActiveApplicationDecision('')
    }
  }

  const canCancelSelected =
    isStaff &&
    selectedApplication &&
    ['pending_ai_review', 'ai_verified', 'ai_rejected'].includes(selectedApplication.status)

  const canSimulateAiResult =
    isStaff &&
    selectedApplication &&
    selectedApplication.status !== 'cancelled_by_staff' &&
    selectedApplication.status !== 'issued'

  return (
    <div className="ps-operations-page ps-page-shell py-5">
      <Container>
        <div className="ps-operations-shell">
          <nav aria-label="breadcrumb" className="mb-4">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <Link to="/">Homepage</Link>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Operations
              </li>
            </ol>
          </nav>

          <div className="ps-operations-hero">
            <div>
              <p className="ps-operations-kicker">Review Center</p>
              <h1 className="ps-operations-title">
                {isStaff ? 'Operations Dashboard' : 'My Applications'}
              </h1>
              <p>
                {isStaff
                  ? 'Review identity files, verify passport applications, and issue documents from separate controlled work areas.'
                  : 'Track your submitted passport applications, application references, current statuses, and any issued passport records.'}
              </p>
            </div>
            <div className="ps-operations-hero-meta">
              <span>{accountReviews.length}</span>
              <small>Account reviews loaded</small>
              <span>{applications.length}</span>
              <small>Applications loaded</small>
            </div>
          </div>

          {pageError && <Alert variant="danger">{pageError}</Alert>}

          <section className="ps-operations-workspace ps-account-review-section">
            <div className="ps-workspace-heading">
              <div>
                <span className="ps-workspace-label">Account Verification</span>
                <h2 className="h5 mb-1">Account Document Review</h2>
                <p className="text-muted small mb-0">
                  Review uploaded national ID images and compare saved user data against the AI extraction.
                </p>
              </div>
              <div className="ps-account-review-filter">
                <Form.Group className="ps-account-review-filter-id">
                  <Form.Label className="small mb-1">Account Verification Code</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>AV-</InputGroup.Text>
                    <Form.Control
                      value={reviewCodeBody}
                      onChange={(event) => setReviewCodeBody(cleanVerificationCodeBody(event.target.value))}
                      placeholder="0000-000000"
                    />
                  </InputGroup>
                </Form.Group>
                <Form.Group className="ps-account-review-filter-select">
                  <Form.Label className="small mb-1">Status</Form.Label>
                  <Form.Select
                    value={reviewStatusFilter}
                    onChange={(event) => setReviewStatusFilter(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="under_review">Under Review</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </Form.Select>
                </Form.Group>
              </div>
            </div>
            {actionSection === 'account-review' && actionError && (
              <Alert variant="danger" className="py-2">{actionError}</Alert>
            )}
            {actionSection === 'account-review' && actionMessage && (
              <Alert variant="success" className="py-2">{actionMessage}</Alert>
            )}

            <div className="ps-account-review-layout">
              <div className="ps-account-review-queue">
                <div className="table-responsive">
                  <Table hover className="align-middle ps-operations-table ps-account-review-table mb-0">
                    <thead>
                      <tr>
                        <th>AV Code</th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountReviews.length ? (
                        accountReviews.map((review) => (
                          <tr
                            key={review.account_verification_id}
                            className={
                              selectedAccountReviewId === review.account_verification_id
                                ? 'ps-selected-row'
                                : ''
                            }
                            onClick={() => setSelectedAccountReviewId(review.account_verification_id)}
                          >
                            <td className="fw-semibold text-nowrap">
                              {review.verification_code || 'Not assigned'}
                            </td>
                            <td>{review.full_name || review.email}</td>
                            <td>{formatStatus(review.status)}</td>
                            <td>{formatDate(review.submitted_at)}</td>
                          </tr>
                        ))
                      ) : (
                          <tr>
                          <td colSpan={4} className="text-center text-muted py-4">
                            No data for {reviewStatusLabel(reviewStatusFilter)}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>

              <div className="ps-account-review-main">
                {!selectedAccountReviewId && (
                  <Alert variant="secondary" className="mb-0">
                    Select an account verification record to review uploaded documents.
                  </Alert>
                )}

                {selectedAccountReviewId && isLoadingReviewDetails && (
                  <Alert variant="secondary" className="mb-0">
                    Loading account verification details...
                  </Alert>
                )}

                {selectedAccountReview && !isLoadingReviewDetails && (
                  <div className="ps-account-review-detail">
                    <div className="mb-3">
                      <div>
                        <h3 className="h6 mb-1">
                          Account Verification {selectedAccountReview.verification_code || 'Not assigned'}
                        </h3>
                        <div className="text-muted small">
                          {selectedAccountReview.full_name || selectedAccountReview.email} ·{' '}
                          {formatStatus(selectedAccountReview.status)}
                        </div>
                        <div className="text-muted small">
                          Extraction: {formatExtractionMethod(selectedAccountReview.extracted_data)}
                        </div>
                        {selectedAccountReview.extracted_data?.face_match_score !== undefined && (
                          <div className="mt-2">
                            <span className="ps-face-score-pill">
                              Face match: {Math.round(Number(selectedAccountReview.extracted_data.face_match_score))}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {reviewHasMismatchedValues(selectedAccountReview) && (
                      <div className="ps-review-notice mb-3">
                        Some values do not match. Staff review is required.
                      </div>
                    )}

                    <div className="ps-account-review-image-grid">
                      {selectedAccountReview.id_face_image_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              src: selectedAccountReview.id_face_image_url,
                              title: 'Extracted ID Face',
                            })
                          }
                          className="ps-account-review-image ps-account-review-image-link"
                        >
                          <img src={selectedAccountReview.id_face_image_url} alt="Extracted ID face" />
                          <span>Extracted ID Face</span>
                        </button>
                      )}
                      {selectedAccountReview.signature_image_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              src: selectedAccountReview.signature_image_url,
                              title: 'Extracted Signature',
                            })
                          }
                          className="ps-account-review-image ps-account-review-image-link"
                        >
                          <img src={selectedAccountReview.signature_image_url} alt="Extracted signature" />
                          <span>Extracted Signature</span>
                        </button>
                      )}
                      {selectedAccountReview.files?.map((file) => (
                        <button
                          type="button"
                          key={file.verification_file_id}
                          onClick={() =>
                            setPreviewImage({
                              src: file.signed_url,
                              title: formatStatus(file.document_type),
                            })
                          }
                          className="ps-account-review-image ps-account-review-image-link"
                        >
                          <img src={file.signed_url} alt={formatStatus(file.document_type)} />
                          <span>{formatStatus(file.document_type)}</span>
                        </button>
                      ))}
                    </div>

                    <div className="table-responsive mb-3">
                      <Table bordered size="sm" className="align-middle mb-0 ps-operations-table ps-account-review-comparison">
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>User Provided</th>
                            <th>AI Extracted</th>
                            <th className="text-center">Match</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviewFieldRows.map(([field, label]) => {
                            const providedValue = selectedAccountReview[field]
                            const extractedValue = selectedAccountReview.extracted_data?.[field]
                            const rawArabicValue =
                              selectedAccountReview.extracted_data?._raw_arabic?.[field]
                            const isMatch = reviewValuesMatch(providedValue, extractedValue, field)

                            return (
                              <tr key={field}>
                                <td className="fw-semibold">{label}</td>
                                <td>{formatReviewValue(providedValue)}</td>
                                <td>
                                  <ReviewExtractedValue value={extractedValue} rawValue={rawArabicValue} />
                                </td>
                                <td className="text-center">
                                  <span
                                    className={`ps-review-match ${
                                      isMatch ? 'ps-review-match-ok' : 'ps-review-match-bad'
                                    }`}
                                    title={isMatch ? 'Values match' : 'Values do not match'}
                                    aria-label={isMatch ? 'Values match' : 'Values do not match'}
                                  >
                                    {isMatch ? '✓' : '×'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </Table>
                    </div>

                    <Form.Group>
                      <Form.Label>Decision notes</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={reviewDecisionNotes}
                        onChange={(event) => setReviewDecisionNotes(event.target.value)}
                        placeholder="Optional staff note for accepting or rejecting this account verification."
                      />
                    </Form.Group>
                    <div className="ps-account-review-actions mt-3">
                      <Button
                        variant="outline-success"
                        onClick={() => handleReviewDecision('accept')}
                        disabled={!!activeReviewDecision}
                      >
                        {activeReviewDecision === 'accept' ? 'Saving...' : 'Accept'}
                      </Button>
                      <Button
                        variant="outline-danger"
                        onClick={() => handleReviewDecision('reject')}
                        disabled={!!activeReviewDecision}
                      >
                        {activeReviewDecision === 'reject' ? 'Saving...' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="ps-operations-workspace ps-passport-review-section">
            <div className="ps-workspace-heading">
              <div>
                <span className="ps-workspace-label">Passport Verification</span>
                <h2 className="h5 mb-1">Passport Application Review</h2>
                <p className="text-muted small mb-0">
                  Search passport applications, inspect verification results, and issue passports after approval.
                </p>
              </div>
            </div>

          <div className="ps-account-review-layout">
            <div className="ps-account-review-queue">
              <div className="ps-operations-panel mb-4">
                <h2 className="h5 mb-3">
                  {isStaff ? 'Application Search' : 'Submitted Applications'}
                </h2>

                {isStaff && (
                  <Form onSubmit={handleSearchSubmit} className="mb-4">
                    <Row className="g-3 align-items-end">
                      <Col md={6}>
                        <Form.Label>Search by reference, name, or national ID</Form.Label>
                        <InputGroup>
                          <InputGroup.Text>PS-APP-</InputGroup.Text>
                          <Form.Control
                            value={applicationReferenceNumber}
                            onChange={(event) =>
                              setApplicationReferenceNumber(cleanApplicationReferenceNumber(event.target.value))
                            }
                            placeholder="2026-000000"
                          />
                        </InputGroup>
                      </Col>
                      <Col md={3}>
                        <Form.Label>Status</Form.Label>
                        <Form.Select
                          value={statusFilter}
                          onChange={(event) => setStatusFilter(event.target.value)}
                        >
                          <option value="">All statuses</option>
                          {staffVisibleStatuses.map((status) => (
                            <option key={status} value={status}>
                              {formatStatus(status)}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                      <Col md={3}>
                        <Button type="submit" variant="primary" className="w-100" disabled={isLoading}>
                          {isLoading ? 'Searching...' : 'Search'}
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                )}

                <div className="table-responsive">
                  <Table hover className="align-middle ps-operations-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Applicant</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.length > 0 ? (
                        applications.map((application) => (
                          <tr
                            key={application.application_id}
                            className={
                              selectedApplicationId === application.application_id
                                ? 'ps-selected-row'
                                : ''
                            }
                            onClick={() => setSelectedApplicationId(application.application_id)}
                          >
                            <td className="fw-semibold">{application.application_reference}</td>
                            <td>{`${application.first_name} ${application.last_name}`}</td>
                            <td>{formatStatus(application.status)}</td>
                            <td>{formatDate(application.application_date)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center text-muted py-4">
                            No applications found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="ps-account-review-main">
              <div className="ps-operations-panel ps-application-details-panel h-100">
                <div className="ps-application-details-heading">
                  <div>
                    <h2 className="h5 mb-1">Application Details</h2>
                    <p className="text-muted small mb-0">Selected application record and staff actions.</p>
                  </div>
                </div>
                {actionSection === 'passport-application' && actionError && (
                  <Alert variant="danger" className="py-2">{actionError}</Alert>
                )}
                {actionSection === 'passport-application' && actionMessage && (
                  <Alert variant="success" className="py-2">{actionMessage}</Alert>
                )}

                {!selectedApplicationId && (
                  <Alert variant="secondary" className="mb-0">
                    Select an application record to view the full details.
                  </Alert>
                )}

                {selectedApplicationId && isLoadingDetails && (
                  <Alert variant="secondary" className="mb-0">
                    Loading application details...
                  </Alert>
                )}

                {selectedApplication && !isLoadingDetails && (
                  <>
                    <div className="ps-application-review-summary mb-3">
                      <h3 className="h6 mb-1">{selectedApplication.application_reference}</h3>
                      <div className="text-muted small">
                        {`${selectedApplication.first_name} ${selectedApplication.last_name}`} ·{' '}
                        {formatStatus(selectedApplication.status)}
                      </div>
                      <div className="text-muted small">
                        {formatStatus(selectedApplication.application_type)} ·{' '}
                        {formatStatus(selectedApplication.passport_type)} · Submitted{' '}
                        {formatDate(selectedApplication.application_date)}
                      </div>
                      <div className="text-muted small">
                        Extraction: {formatExtractionMethod(selectedApplication.ai_extracted_data)}
                      </div>
                      {selectedApplication.application_type === 'renewal' &&
                        selectedApplication.ai_extracted_data?.passport_photo_face_match_score !== undefined && (
                          <div className="mt-2">
                            <span className="ps-face-score-pill">
                              Face match:{' '}
                              {Math.round(Number(selectedApplication.ai_extracted_data.passport_photo_face_match_score))}%
                            </span>
                          </div>
                        )}
                    </div>

                    {passportReviewHasMismatchedValues(selectedApplication) && (
                      <div className="ps-review-notice mb-3">
                        Some values do not match. Staff review is required.
                      </div>
                    )}

                    <div className="ps-application-detail-section mb-3">
                      <div className="ps-account-review-image-grid mb-3">
                        {selectedApplication.passport_photo_image_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                src: selectedApplication.passport_photo_image_url,
                                title: 'Extracted Passport Photo',
                              })
                            }
                            className="ps-account-review-image ps-account-review-image-link"
                          >
                            <img src={selectedApplication.passport_photo_image_url} alt="Extracted passport" />
                            <span>Extracted Passport Photo</span>
                          </button>
                        )}
                        {selectedApplication.passport_signature_image_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                src: selectedApplication.passport_signature_image_url,
                                title: 'Extracted Passport Signature',
                              })
                            }
                            className="ps-account-review-image ps-account-review-image-link"
                          >
                            <img
                              src={selectedApplication.passport_signature_image_url}
                              alt="Extracted passport signature"
                            />
                            <span>Extracted Passport Signature</span>
                          </button>
                        )}
                        {selectedApplication.national_id_signature_image_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                src: selectedApplication.national_id_signature_image_url,
                                title: 'National ID Signature',
                              })
                            }
                            className="ps-account-review-image ps-account-review-image-link"
                          >
                            <img
                              src={selectedApplication.national_id_signature_image_url}
                              alt="National ID signature"
                            />
                            <span>National ID Signature</span>
                          </button>
                        )}
                        {selectedApplication.passport_mrz_image_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                src: selectedApplication.passport_mrz_image_url,
                                title: 'Passport Data Strip',
                              })
                            }
                            className="ps-account-review-image ps-account-review-image-link"
                          >
                            <img src={selectedApplication.passport_mrz_image_url} alt="Passport data strip" />
                            <span>Passport Data Strip</span>
                          </button>
                        )}
                        {selectedApplication.documents?.map((document) => (
                          <button
                            type="button"
                            key={document.document_id}
                            onClick={() =>
                              setPreviewImage({
                                src: document.signed_url,
                                title: formatStatus(document.document_type),
                              })
                            }
                            className="ps-account-review-image ps-account-review-image-link"
                          >
                            <img src={document.signed_url} alt={formatStatus(document.document_type)} />
                            <span>{formatStatus(document.document_type)}</span>
                          </button>
                        ))}
                      </div>
                      {selectedApplication.ai_extracted_data &&
                      Object.keys(selectedApplication.ai_extracted_data || {}).length ? (
                        <>
                          <div className="table-responsive">
                            <Table bordered size="sm" className="align-middle mb-0 ps-operations-table ps-account-review-comparison">
                              <thead>
                                <tr>
                                  <th>Field</th>
                                  <th>User Provided</th>
                                  <th>AI Extracted</th>
                                  <th className="text-center">Match</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getPassportComparisonRows(selectedApplication).map((row) => {
                                  return (
                                    <tr key={row.field}>
                                      <td className="fw-semibold">{row.label}</td>
                                      <td>{formatReviewValue(row.expected)}</td>
                                      <td>{formatReviewValue(row.actual)}</td>
                                      <td className="text-center">
                                        <span
                                          className={`ps-review-match ${
                                            row.match ? 'ps-review-match-ok' : 'ps-review-match-bad'
                                          }`}
                                        >
                                          {row.match ? '✓' : '×'}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </Table>
                          </div>
                          <div className="d-flex flex-wrap gap-2 mt-3">
                            {selectedApplication.ai_extracted_data.signature_match_score !== undefined && (
                              <span className="ps-face-score-pill">
                                Signature match:{' '}
                                {Math.round(Number(selectedApplication.ai_extracted_data.signature_match_score))}%
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-muted small mb-0">
                          OCR results will appear here after passport AI verification runs.
                        </p>
                      )}
                    </div>

                    <div className="ps-application-detail-section mb-3">
                      <Form.Group>
                        <Form.Label>Decision notes</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={applicationDecisionNotes}
                          onChange={(event) => setApplicationDecisionNotes(event.target.value)}
                          placeholder="Optional staff note for accepting or rejecting this passport application."
                        />
                      </Form.Group>
                      <div className="ps-account-review-actions mt-3">
                        <Button
                          variant="outline-success"
                          onClick={() => handleApplicationDecision('accept')}
                          disabled={!!activeApplicationDecision}
                        >
                          {activeApplicationDecision === 'accept' ? 'Saving...' : 'Accept'}
                        </Button>
                        <Button
                          variant="outline-danger"
                          onClick={() => handleApplicationDecision('reject')}
                          disabled={!!activeApplicationDecision}
                        >
                          {activeApplicationDecision === 'reject' ? 'Saving...' : 'Reject'}
                        </Button>
                      </div>
                    </div>

                    {selectedApplication.passport_record && (
                      <div className="ps-application-detail-section mb-3">
                        <h3 className="h6 mb-2">Issued Passport Record</h3>
                        <Card className="ps-application-summary-card">
                          <Card.Body>
                            <div className="ps-operations-meta-row">
                              <span>Passport Number</span>
                              <strong>{selectedApplication.passport_record.passport_number}</strong>
                            </div>
                            <div className="ps-operations-meta-row">
                              <span>Issue Date</span>
                              <strong>{formatDate(selectedApplication.passport_record.issue_date)}</strong>
                            </div>
                            <div className="ps-operations-meta-row">
                              <span>Expiry Date</span>
                              <strong>{formatDate(selectedApplication.passport_record.expiry_date)}</strong>
                            </div>
                          </Card.Body>
                        </Card>
                      </div>
                    )}

                    {canSimulateAiResult && (
                      <div className="ps-application-detail-section mb-3">
                        <h3 className="h6 mb-2">Application AI Verification</h3>
                        <p className="small text-muted mb-3">
                          Runs deterministic checks against the verified account, passport details, dates, and
                          required uploaded documents.
                        </p>
                        {selectedApplication.notes && (
                          <pre className="ps-application-ai-notes mb-3">{selectedApplication.notes}</pre>
                        )}
                        <Button
                          variant="primary"
                          onClick={handleRunApplicationAiReview}
                          disabled={isRunningApplicationAi}
                        >
                          {isRunningApplicationAi ? 'Running verification...' : 'Run AI Verification'}
                        </Button>
                      </div>
                    )}

                    {canCancelSelected && (
                      <div className="ps-application-detail-section mb-3">
                        <h3 className="h6 mb-2">Cancel Application</h3>
                        <Form.Group className="mb-3">
                          <Form.Label>Cancellation reason</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={3}
                            value={cancellationReason}
                            onChange={(event) => setCancellationReason(event.target.value)}
                            placeholder="Explain why the application is being cancelled after staff review."
                          />
                        </Form.Group>
                        <Button variant="outline-danger" onClick={handleCancelApplication} disabled={isCancelling}>
                          {isCancelling ? 'Cancelling...' : 'Cancel Application'}
                        </Button>
                      </div>
                    )}

                  </>
                )}
              </div>
            </div>
          </div>
          </section>
        </div>
      </Container>
      <Modal
        show={!!previewImage}
        onHide={() => setPreviewImage(null)}
        centered
        size="xl"
        className="ps-image-preview-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title className="h6 mb-0">{previewImage?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {previewImage?.src && (
            <img src={previewImage.src} alt={previewImage.title} className="ps-image-preview-modal-image" />
          )}
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default OperationsPage

import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Container, Form, InputGroup, Modal, Table } from 'react-bootstrap'
import { Link, Navigate } from 'react-router-dom'
import { LEBANESE_VILLAGE_OPTIONS } from '../data/lebaneseVillages'
import { resolveApiAssetUrl } from '../services/apiClient'
import {
  changePasswordFromAccount,
  getCurrentUser,
  requestChangePasswordCode,
  submitAccountVerificationFiles,
  updateCurrentUserDetails,
  updateProfilePhoto,
} from '../services/passportService'
import { formatDisplayDate, toDateInputValue } from '../utils/dateUtils'
import './AccountPage.css'

const CHANGE_PASSWORD_CODE_LENGTH = 8
const CHANGE_PASSWORD_RESEND_COOLDOWN_SECONDS = 60

const formatRole = (role) => {
  if (!role) {
    return 'Unknown'
  }

  return role.charAt(0).toUpperCase() + role.slice(1)
}

const buildStatusLabel = (status) => {
  if (!status) {
    return 'Pending'
  }

  return status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

const governorateOptions = [
  ['beirut', 'Beirut'],
  ['mount_lebanon', 'Mount Lebanon'],
  ['north_lebanon', 'North Lebanon'],
  ['akkar', 'Akkar'],
  ['beqaa', 'Beqaa'],
  ['baalbek_hermel', 'Baalbek-Hermel'],
  ['south_lebanon', 'South Lebanon'],
  ['nabatieh', 'Nabatieh'],
]

const buildAccountDetailsForm = (user = {}) => ({
  first_name: user.first_name || '',
  middle_name: user.middle_name || '',
  last_name: user.last_name || '',
  father_name: user.father_name || '',
  mother_name: user.mother_name || '',
  date_of_birth: toDateInputValue(user.date_of_birth),
  place_of_birth: user.place_of_birth || '',
  phone: user.phone || '',
  national_id_number: user.national_id_number || '',
  gender: user.gender || '',
  governorate: user.governorate || '',
  blood_type: user.blood_type || '',
  marital_status: user.marital_status || '',
  registry_number: user.registry_number || '',
})

const AccountPage = ({ currentUser, token, onUserUpdate }) => {
  const inputRefs = useRef([])
  const [accountForm, setAccountForm] = useState(() => buildAccountDetailsForm(currentUser))
  const [accountEditError, setAccountEditError] = useState('')
  const [accountEditSuccess, setAccountEditSuccess] = useState('')
  const [isSavingAccountDetails, setIsSavingAccountDetails] = useState(false)
  const [selectedProfilePhoto, setSelectedProfilePhoto] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const [photoSuccess, setPhotoSuccess] = useState('')
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [previewProfilePhoto, setPreviewProfilePhoto] = useState(false)
  const [verificationFiles, setVerificationFiles] = useState({
    national_id_front: null,
    national_id_back: null,
    selfie_photo: null,
  })
  const [verificationError, setVerificationError] = useState('')
  const [verificationSuccess, setVerificationSuccess] = useState('')
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false)
  const [changePasswordDigits, setChangePasswordDigits] = useState(
    Array(CHANGE_PASSWORD_CODE_LENGTH).fill('')
  )
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState('')
  const [changePasswordInfo, setChangePasswordInfo] = useState('')
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('')
  const [devChangePasswordCode, setDevChangePasswordCode] = useState('')
  const [isRequestingChangeCode, setIsRequestingChangeCode] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [changePasswordCooldown, setChangePasswordCooldown] = useState(0)

  useEffect(() => {
    setAccountForm(buildAccountDetailsForm(currentUser))
  }, [currentUser])

  useEffect(() => {
    if (!token || !currentUser) {
      return undefined
    }

    let isMounted = true

    const refreshCurrentUser = async () => {
      try {
        const response = await getCurrentUser(token)
        if (isMounted && response.data) {
          onUserUpdate?.(response.data)
        }
      } catch {
        // Keep the current local session if a background refresh fails.
      }
    }

    refreshCurrentUser()
    window.addEventListener('focus', refreshCurrentUser)

    return () => {
      isMounted = false
      window.removeEventListener('focus', refreshCurrentUser)
    }
  }, [token, currentUser?.user_id])

  useEffect(() => {
    if (changePasswordCooldown <= 0) {
      return undefined
    }

    const timer = setTimeout(() => {
      setChangePasswordCooldown((previous) => previous - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [changePasswordCooldown])

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: '/account' }} />
  }

  const fullName =
    currentUser.full_name ||
    [currentUser.first_name, currentUser.middle_name, currentUser.last_name].filter(Boolean).join(' ')

  const isApplicantPendingVerification =
    currentUser.role === 'applicant' && currentUser.verification_status !== 'verified'
  const canUpdateProfilePhoto = currentUser.verification_status === 'verified'
  const profilePhotoUrl = currentUser.profile_photo_path
    ? resolveApiAssetUrl(currentUser.profile_photo_path)
    : ''
  const statusVariant = isApplicantPendingVerification ? 'warning' : 'primary'
  const statusMessage = isApplicantPendingVerification
    ? (
        <>
          Logged in as <strong>{fullName || currentUser.email}</strong> ({currentUser.role}). Your account is currently{' '}
          <strong>{buildStatusLabel(currentUser.verification_status)}</strong>, so passport application submission will
          stay locked until an admin or officer verifies your account.
        </>
      )
    : (
        <>
          Logged in as <strong>{fullName || currentUser.email}</strong> ({currentUser.role}). Your account is ready for
          profile management and system access.
        </>
      )

  const changePasswordCode = changePasswordDigits.join('')
  const isAdmin = currentUser.role === 'admin'

  const editableAccountRows = [
    { label: 'First name', field: 'first_name', required: true },
    { label: 'Middle name', field: 'middle_name' },
    { label: 'Last name', field: 'last_name', required: true },
    { label: 'Father name', field: 'father_name' },
    { label: 'Mother name', field: 'mother_name' },
    { label: 'Phone number', field: 'phone', type: 'phone' },
    { label: 'Date of birth', field: 'date_of_birth', type: 'date' },
    {
      label: 'Place of birth',
      field: 'place_of_birth',
      type: 'select',
      options: [['', 'Select place of birth'], ...LEBANESE_VILLAGE_OPTIONS.map((village) => [village, village])],
    },
    {
      label: 'Gender',
      field: 'gender',
      type: 'select',
      options: [
        ['', 'Select gender'],
        ['male', 'Male'],
        ['female', 'Female'],
        ['other', 'Other'],
      ],
    },
    {
      label: 'Governorate',
      field: 'governorate',
      type: 'select',
      options: [['', 'Select governorate'], ...governorateOptions],
    },
    {
      label: 'Marital status',
      field: 'marital_status',
      type: 'select',
      options: [
        ['', 'Select status'],
        ['single', 'Single'],
        ['married', 'Married'],
        ['divorced', 'Divorced'],
        ['widowed', 'Widowed'],
      ],
      hidden: isAdmin,
    },
  ].filter((row) => !row.hidden)

  const readonlyAccountRows = [
    ['Email', currentUser.email || 'Not provided'],
    !isAdmin ? ['National ID number', currentUser.national_id_number || 'Not provided'] : null,
    !isAdmin ? ['Blood type', currentUser.blood_type || 'Not provided'] : null,
    !isAdmin ? ['Registry number', currentUser.registry_number || 'Not provided'] : null,
    !isAdmin ? ['Email verified at', formatDisplayDate(currentUser.email_verified_at)] : null,
    ['Role', formatRole(currentUser.role)],
    !isAdmin ? ['Verification status', buildStatusLabel(currentUser.verification_status)] : null,
    !isAdmin ? ['Applicant link', currentUser.applicant_id ? `Applicant #${currentUser.applicant_id}` : 'No applicant profile yet'] : null,
    ['Created at', formatDisplayDate(currentUser.created_at)],
  ].filter(Boolean)

  const updateAccountField = (field, value) => {
    setAccountForm((previous) => ({ ...previous, [field]: value }))
  }

  const handleAccountDetailsSubmit = async (event) => {
    event.preventDefault()
    setAccountEditError('')
    setAccountEditSuccess('')

    if (!accountForm.first_name.trim() || !accountForm.last_name.trim()) {
      setAccountEditError('First name and last name are required.')
      return
    }

    if (accountForm.phone && !/^\+961\d{8}$/.test(accountForm.phone.trim())) {
      setAccountEditError('Phone number must start with +961 followed by 8 digits.')
      return
    }

    setIsSavingAccountDetails(true)

    try {
      const payload = Object.fromEntries(
        Object.entries(accountForm).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      )
      const response = await updateCurrentUserDetails(payload, token)
      onUserUpdate?.(response.data)
      setAccountEditSuccess(response.message || 'Account details updated successfully.')
    } catch (error) {
      setAccountEditError(error.message || 'Failed to update account details')
    } finally {
      setIsSavingAccountDetails(false)
    }
  }

  const handleProfilePhotoSubmit = async (event) => {
    event.preventDefault()
    setPhotoError('')
    setPhotoSuccess('')

    if (!selectedProfilePhoto) {
      setPhotoError('Please choose a profile photo first.')
      return
    }

    setIsUploadingPhoto(true)

    try {
      const payload = new FormData()
      payload.append('profile_photo', selectedProfilePhoto)

      const response = await updateProfilePhoto(payload, token)

      onUserUpdate?.(response.data)
      setPhotoSuccess('Profile photo updated successfully.')
      setSelectedProfilePhoto(null)
    } catch (error) {
      setPhotoError(error.message || 'Failed to update profile photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const updateVerificationFile = (field, file) => {
    setVerificationFiles((previous) => ({ ...previous, [field]: file || null }))
  }

  const handleVerificationSubmit = async (event) => {
    event.preventDefault()
    setVerificationError('')
    setVerificationSuccess('')

    if (
      !verificationFiles.national_id_front ||
      !verificationFiles.national_id_back ||
      !verificationFiles.selfie_photo
    ) {
      setVerificationError('Upload the national ID front, national ID back, and selfie photo.')
      return
    }

    setIsSubmittingVerification(true)

    try {
      const payload = new FormData()
      payload.append('national_id_front', verificationFiles.national_id_front)
      payload.append('national_id_back', verificationFiles.national_id_back)
      payload.append('selfie_photo', verificationFiles.selfie_photo)

      const response = await submitAccountVerificationFiles(payload, token)

      onUserUpdate?.(response.data?.user)
      setVerificationFiles({
        national_id_front: null,
        national_id_back: null,
        selfie_photo: null,
      })

      setVerificationSuccess(
        response.message ||
          'Verification files submitted. The review will continue in the background and you will receive an email when it finishes.'
      )
    } catch (error) {
      setVerificationError(error.message || 'Failed to submit verification files')
    } finally {
      setIsSubmittingVerification(false)
    }
  }

  const updateChangePasswordDigit = (index, rawValue) => {
    const nextValue = rawValue.replace(/\D/g, '').slice(-1)
    const nextDigits = [...changePasswordDigits]
    nextDigits[index] = nextValue
    setChangePasswordDigits(nextDigits)

    if (nextValue && index < CHANGE_PASSWORD_CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleChangePasswordKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !changePasswordDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleChangePasswordPaste = (event) => {
    const pasted = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, CHANGE_PASSWORD_CODE_LENGTH)

    if (!pasted) {
      return
    }

    event.preventDefault()

    const nextDigits = Array(CHANGE_PASSWORD_CODE_LENGTH).fill('')
    pasted.split('').forEach((character, index) => {
      nextDigits[index] = character
    })

    setChangePasswordDigits(nextDigits)
    inputRefs.current[Math.min(pasted.length, CHANGE_PASSWORD_CODE_LENGTH) - 1]?.focus()
  }

  const handleRequestChangePasswordCode = async () => {
    setChangePasswordError('')
    setChangePasswordInfo('')
    setChangePasswordSuccess('')
    setDevChangePasswordCode('')

    setIsRequestingChangeCode(true)

    try {
      const response = await requestChangePasswordCode(token)
      setChangePasswordInfo(response.message || 'A password change code has been sent to your email address.')
      setDevChangePasswordCode(response.data?.dev_change_password_code || '')
      setChangePasswordCooldown(CHANGE_PASSWORD_RESEND_COOLDOWN_SECONDS)
      setChangePasswordDigits(Array(CHANGE_PASSWORD_CODE_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } catch (error) {
      setChangePasswordError(error.message || 'Failed to send password change code')
    } finally {
      setIsRequestingChangeCode(false)
    }
  }

  const handleChangePasswordSubmit = async (event) => {
    event.preventDefault()
    setChangePasswordError('')
    setChangePasswordInfo('')
    setChangePasswordSuccess('')

    if (changePasswordCode.length !== CHANGE_PASSWORD_CODE_LENGTH) {
      setChangePasswordError('Enter the full 8-digit password change code.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setChangePasswordError('New passwords do not match.')
      return
    }

    setIsChangingPassword(true)

    try {
      const response = await changePasswordFromAccount(
        {
          code: changePasswordCode,
          new_password: newPassword,
        },
        token
      )

      setChangePasswordSuccess(response.message || 'Password changed successfully.')
      setChangePasswordDigits(Array(CHANGE_PASSWORD_CODE_LENGTH).fill(''))
      setNewPassword('')
      setConfirmNewPassword('')
      setDevChangePasswordCode('')
    } catch (error) {
      setChangePasswordError(error.message || 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="ps-account-page ps-page-shell py-5">
      <Container>
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/">Homepage</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              My Account
            </li>
          </ol>
        </nav>

        <div className="bg-white rounded shadow-sm p-4 p-lg-5 mb-4">
          <h1 className="mb-4 ps-account-title">My Account</h1>

          <div className={`mb-4 p-3 rounded ps-account-callout ps-account-callout-${statusVariant}`}>
            <h2 className="h5 mb-2">Account Overview</h2>
            <p className="mb-2">{statusMessage}</p>
            <div className="d-flex flex-wrap gap-2">
              {currentUser.role !== 'admin' && (
                <Link to="/passport-application" className="btn btn-primary">
                  Open passport application
                </Link>
              )}
              {['admin', 'officer'].includes(currentUser.role) && (
                <Link to="/operations" className="btn btn-outline-primary">
                  Open operations
                </Link>
              )}
            </div>
          </div>

          <div className="mb-4">
            <h2 className="h5 mb-3">Account holder</h2>
            <p className="mb-2">
              <strong>{fullName || 'Unnamed User'}</strong>
            </p>
            <p className="text-muted mb-0">
              This page shows the information currently saved for your login account inside the passport system.
            </p>
            {currentUser.role === 'applicant' && (
              <div className="ps-account-verification-code mt-3">
                <span>Member ID</span>
                <strong>{currentUser.member_id || 'Not assigned yet'}</strong>
              </div>
            )}
          </div>

          <div className="mb-4 ps-account-photo-section">
            <h2 className="h5 mb-3">Profile photo</h2>
            <div className="ps-account-photo-panel">
              <div className="ps-account-photo-preview">
                {profilePhotoUrl ? (
                  <button
                    type="button"
                    className="ps-account-photo-preview-button"
                    onClick={() => setPreviewProfilePhoto(true)}
                    aria-label="View profile photo"
                  >
                    <img src={profilePhotoUrl} alt={fullName || currentUser.email} className="ps-account-photo-image" />
                  </button>
                ) : (
                  <div className="ps-account-photo-fallback">
                    {(fullName || currentUser.email).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="ps-account-photo-content">
                <p className="mb-2">
                  The header profile icon uses the selfie submitted during registration as the starting image.
                </p>
                <p className="text-muted small mb-3">
                  After the account is verified, you can replace it with a new personal profile photo.
                </p>

                {photoError && <Alert variant="danger" className="py-2 mb-3">{photoError}</Alert>}
                {photoSuccess && <Alert variant="success" className="py-2 mb-3">{photoSuccess}</Alert>}

                {canUpdateProfilePhoto ? (
                  <Form onSubmit={handleProfilePhotoSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label>Change profile photo</Form.Label>
                      <Form.Control
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => setSelectedProfilePhoto(event.target.files?.[0] || null)}
                      />
                      <Form.Text className="text-muted">
                        JPG, PNG, or WEBP up to 5 MB.
                      </Form.Text>
                    </Form.Group>
                    <Button type="submit" variant="primary" disabled={isUploadingPhoto}>
                      {isUploadingPhoto ? 'Updating photo...' : 'Update profile photo'}
                    </Button>
                  </Form>
                ) : (
                  <Alert variant="secondary" className="mb-0">
                    Profile photo changes are available after the account status becomes <strong>verified</strong>.
                  </Alert>
                )}
              </div>
            </div>
          </div>

          {currentUser.role === 'applicant' && currentUser.verification_status !== 'verified' && (
            <div className="mb-4">
              <h2 className="h5 mb-3">Account Verification</h2>
              <div className="ps-account-security-panel">
                <p className="text-muted mb-3">
                  Upload clear images of the national ID front, national ID back, and a current selfie. The system will
                  compare the ID data and face photo with your saved account details.
                </p>

                {verificationError && <Alert variant="danger" className="py-2 mb-3">{verificationError}</Alert>}
                {verificationSuccess && <Alert variant="success" className="py-2 mb-3">{verificationSuccess}</Alert>}

                <Form onSubmit={handleVerificationSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>National ID Front</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => updateVerificationFile('national_id_front', event.target.files?.[0])}
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>National ID Back</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => updateVerificationFile('national_id_back', event.target.files?.[0])}
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Selfie Photo</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => updateVerificationFile('selfie_photo', event.target.files?.[0])}
                      required
                    />
                  </Form.Group>

                  <Button type="submit" variant="primary" disabled={isSubmittingVerification}>
                    {isSubmittingVerification ? 'Checking files...' : 'Submit Verification'}
                  </Button>
                </Form>
              </div>
            </div>
          )}

          <div className="mb-4">
            <h2 className="h5 mb-3">Saved account details</h2>
            <p className="text-muted mb-3">
              Edit saved identity and contact details directly in the table. Email, role, password, and verification
              status are managed through their separate security flows.
            </p>

            {accountEditError && <Alert variant="danger" className="py-2 mb-3">{accountEditError}</Alert>}
            {accountEditSuccess && <Alert variant="success" className="py-2 mb-3">{accountEditSuccess}</Alert>}

            <Form onSubmit={handleAccountDetailsSubmit}>
              <Table bordered responsive className="align-middle ps-account-table ps-account-edit-table">
                <tbody>
                  {editableAccountRows.map((row) => (
                    <tr key={row.field}>
                      <th>{row.label}</th>
                      <td>
                        {row.type === 'select' ? (
                          <Form.Select
                            value={accountForm[row.field]}
                            onChange={(event) => updateAccountField(row.field, event.target.value)}
                          >
                            {row.options.map(([value, label]) => (
                              <option key={value || label} value={value}>{label}</option>
                            ))}
                          </Form.Select>
                        ) : row.type === 'phone' ? (
                          <InputGroup>
                            <InputGroup.Text>+961</InputGroup.Text>
                            <Form.Control
                              type="tel"
                              inputMode="numeric"
                              maxLength={8}
                              value={accountForm.phone.replace(/^\+961/, '').replace(/\D/g, '').slice(0, 8)}
                              onChange={(event) =>
                                updateAccountField('phone', `+961${event.target.value.replace(/\D/g, '').slice(0, 8)}`)
                              }
                            />
                          </InputGroup>
                        ) : (
                          <Form.Control
                            type={row.type || 'text'}
                            value={accountForm[row.field]}
                            onChange={(event) => updateAccountField(row.field, event.target.value)}
                            required={row.required}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                  {readonlyAccountRows.map(([label, value]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="ps-account-edit-actions">
                <Button type="submit" variant="primary" disabled={isSavingAccountDetails}>
                  {isSavingAccountDetails ? 'Saving...' : 'Save details'}
                </Button>
              </div>
            </Form>
          </div>

          <div className="mb-4">
            <h2 className="h5 mb-3">Change password</h2>
            <div className="ps-account-security-panel">
              <p className="text-muted mb-3">
                Request an 8-digit code by email, then enter it here with your new password to confirm the change.
              </p>

              {changePasswordError && <Alert variant="danger" className="py-2 mb-3">{changePasswordError}</Alert>}
              {changePasswordInfo && <Alert variant="success" className="py-2 mb-3">{changePasswordInfo}</Alert>}
              {changePasswordSuccess && <Alert variant="success" className="py-2 mb-3">{changePasswordSuccess}</Alert>}
              {devChangePasswordCode && (
                <Alert variant="secondary" className="py-2 mb-3">
                  <strong>Local development password change code:</strong> {devChangePasswordCode}
                </Alert>
              )}

              <Form onSubmit={handleChangePasswordSubmit}>
                <Form.Group className="mb-4">
                  <Form.Label>8-Digit Change Password Code</Form.Label>
                  <div className="d-flex gap-2 justify-content-center flex-wrap" onPaste={handleChangePasswordPaste}>
                    {changePasswordDigits.map((digit, index) => (
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
                        onChange={(event) => updateChangePasswordDigit(index, event.target.value)}
                        onKeyDown={(event) => handleChangePasswordKeyDown(index, event)}
                      />
                    ))}
                  </div>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline-secondary"
                      onClick={() => setShowNewPassword((previous) => !previous)}
                    >
                      {showNewPassword ? 'Hide' : 'Show'}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>Confirm New Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline-secondary"
                      onClick={() => setShowConfirmNewPassword((previous) => !previous)}
                    >
                      {showConfirmNewPassword ? 'Hide' : 'Show'}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <div className="d-flex flex-column flex-sm-row gap-2">
                  <Button
                    type="button"
                    variant="outline-primary"
                    className="flex-fill"
                    onClick={handleRequestChangePasswordCode}
                    disabled={isRequestingChangeCode || changePasswordCooldown > 0}
                  >
                    {changePasswordCooldown > 0
                      ? `Resend Code (${changePasswordCooldown}s)`
                      : isRequestingChangeCode
                        ? 'Sending...'
                        : 'Send Code'}
                  </Button>
                  <Button type="submit" variant="primary" className="flex-fill" disabled={isChangingPassword}>
                    {isChangingPassword ? 'Changing password...' : 'Confirm Password Change'}
                  </Button>
                </div>
              </Form>
            </div>
          </div>

          <div>
            <h2 className="h5 mb-3">Verification notes</h2>
            <ul className="mb-0">
              <li className="mb-2">Applicants must be verified before they can submit a passport application.</li>
              <li className="mb-2">The system stores your national ID number and date of birth for matching checks.</li>
              <li className="mb-2">Uploaded ID images and selfie files are reviewed separately from this page.</li>
            </ul>
          </div>
        </div>
      </Container>
      <Modal
        show={previewProfilePhoto}
        onHide={() => setPreviewProfilePhoto(false)}
        centered
        size="lg"
        className="ps-account-photo-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title className="h6 mb-0">Profile Photo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {profilePhotoUrl && (
            <img src={profilePhotoUrl} alt={fullName || currentUser.email} className="ps-account-photo-modal-image" />
          )}
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default AccountPage

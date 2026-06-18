import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Container, Form, InputGroup, Row, Table } from 'react-bootstrap'
import { Link, Navigate } from 'react-router-dom'
import { LEBANESE_VILLAGE_OPTIONS } from '../data/lebaneseVillages'
import {
  createStaffUser,
  deleteMemberByMemberId,
  deleteStaffUser,
  getUsers,
  lookupMemberByMemberId,
  revokeStaffAccess,
  updateMemberByMemberId,
} from '../services/passportService'
import { formatDisplayDate, toDateInputValue } from '../utils/dateUtils'
import './ManagementPage.css'

const initialForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  role: 'officer',
}

const formatRole = (role) =>
  String(role || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

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

const bloodTypeOptions = [
  ['', 'Select blood type'],
  ['A+', 'A+'],
  ['A-', 'A-'],
  ['B+', 'B+'],
  ['B-', 'B-'],
  ['AB+', 'AB+'],
  ['AB-', 'AB-'],
  ['O+', 'O+'],
  ['O-', 'O-'],
]

const buildMemberForm = (user = {}) => ({
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

const cleanMemberIdNumber = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/^PS-MEM-/i, '')
    .replace(/\D/g, '')
    .slice(0, 6)

const buildMemberId = (value) => {
  const memberNumber = cleanMemberIdNumber(value)
  return memberNumber ? `PS-MEM-${memberNumber}` : ''
}

const ManagementPage = ({ token, currentUser }) => {
  const [users, setUsers] = useState([])
  const [formData, setFormData] = useState(initialForm)
  const [memberId, setMemberId] = useState('')
  const [memberLookup, setMemberLookup] = useState(null)
  const [memberForm, setMemberForm] = useState(buildMemberForm())
  const [memberLookupError, setMemberLookupError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSearchingMember, setIsSearchingMember] = useState(false)
  const [isSavingMember, setIsSavingMember] = useState(false)
  const [isDeletingMember, setIsDeletingMember] = useState(false)
  const [actionUserId, setActionUserId] = useState(null)
  const [pageError, setPageError] = useState('')
  const [createStaffMessage, setCreateStaffMessage] = useState('')
  const [createStaffError, setCreateStaffError] = useState('')
  const [staffAccessMessage, setStaffAccessMessage] = useState('')
  const [staffAccessError, setStaffAccessError] = useState('')
  const [memberActionMessage, setMemberActionMessage] = useState('')

  const isAdmin = currentUser?.role === 'admin'
  const staffUsers = useMemo(
    () => users.filter((user) => ['admin', 'officer'].includes(user.role)),
    [users]
  )

  const loadUsers = async () => {
    setIsLoading(true)
    setPageError('')

    try {
      const response = await getUsers(token)
      setUsers(response.data || [])
    } catch (error) {
      setPageError(error.message || 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (token && isAdmin) {
      loadUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin])

  if (!token || !currentUser) {
    return <Navigate to="/login" replace state={{ from: '/management' }} />
  }

  if (!isAdmin) {
    return <Navigate to="/account" replace />
  }

  const updateField = (field, value) => {
    setFormData((previousData) => ({ ...previousData, [field]: value }))
  }

  const handleCreateStaff = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setCreateStaffError('')
    setCreateStaffMessage('')

    try {
      const payload = {
        ...formData,
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim() || null,
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        verification_status: 'verified',
      }
      const response = await createStaffUser(payload, token)
      setCreateStaffMessage(response.message || 'Staff account created successfully.')
      setFormData(initialForm)
      await loadUsers()
    } catch (error) {
      setCreateStaffError(error.message || 'Failed to create staff account')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevokeAccess = async (user) => {
    setActionUserId(user.user_id)
    setStaffAccessError('')
    setStaffAccessMessage('')

    try {
      const response = await revokeStaffAccess(user.user_id, token)
      setStaffAccessMessage(response.message || 'Staff access revoked.')
      await loadUsers()
    } catch (error) {
      setStaffAccessError(error.message || 'Failed to revoke staff access')
    } finally {
      setActionUserId(null)
    }
  }

  const handleDeleteStaff = async (user) => {
    if (!window.confirm(`Delete staff account for ${user.email}? This cannot be undone.`)) {
      return
    }

    setActionUserId(user.user_id)
    setStaffAccessError('')
    setStaffAccessMessage('')

    try {
      const response = await deleteStaffUser(user.user_id, token)
      setStaffAccessMessage(response.message || 'Staff account deleted.')
      await loadUsers()
    } catch (error) {
      setStaffAccessError(error.message || 'Failed to delete staff account')
    } finally {
      setActionUserId(null)
    }
  }

  const handleLookupMember = async (event) => {
    event.preventDefault()
    setMemberLookup(null)
    setMemberLookupError('')
    setMemberActionMessage('')

    if (!memberId.trim()) {
      setMemberLookupError('Enter the member ID first.')
      return
    }

    setIsSearchingMember(true)

    try {
      const response = await lookupMemberByMemberId(memberId.trim(), token)
      setMemberLookup(response.data)
      setMemberForm(buildMemberForm(response.data?.user))
    } catch (error) {
      setMemberLookupError(error.message || 'No member account was found for that member ID')
    } finally {
      setIsSearchingMember(false)
    }
  }

  const updateMemberField = (field, value) => {
    setMemberForm((previous) => ({ ...previous, [field]: value }))
  }

  const handleSaveMemberData = async (event) => {
    event.preventDefault()
    const id = memberLookup?.user?.member_id

    if (!id) {
      return
    }

    if (!memberForm.first_name.trim() || !memberForm.last_name.trim()) {
      setMemberLookupError('First name and last name are required.')
      return
    }

    setIsSavingMember(true)
    setMemberLookupError('')
    setMemberActionMessage('')

    try {
      const payload = Object.fromEntries(
        Object.entries(memberForm).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      )
      const response = await updateMemberByMemberId(id, payload, token)
      setMemberLookup((previous) => ({
        verification: {
          ...previous.verification,
          ...response.data.verification,
        },
        user: response.data.user,
      }))
      setMemberForm(buildMemberForm(response.data.user))
      setMemberActionMessage(response.message || 'Member account details updated successfully.')
      await loadUsers()
    } catch (error) {
      setMemberLookupError(error.message || 'Failed to update member account details')
    } finally {
      setIsSavingMember(false)
    }
  }

  const handleDeleteMember = async () => {
    const id = memberLookup?.user?.member_id
    const user = memberLookup?.user

    if (!id || !user) {
      return
    }

    if (!window.confirm(`Delete member account for ${user.email}? This cannot be undone.`)) {
      return
    }

    setIsDeletingMember(true)
    setMemberLookupError('')
    setMemberActionMessage('')

    try {
      const response = await deleteMemberByMemberId(id, token)
      setMemberActionMessage(response.message || 'Member account deleted successfully.')
      setMemberLookup(null)
      setMemberId('')
      await loadUsers()
    } catch (error) {
      setMemberLookupError(error.message || 'Failed to delete member account')
    } finally {
      setIsDeletingMember(false)
    }
  }

  return (
    <div className="ps-management-page ps-page-shell py-5">
      <Container>
        <div className="ps-management-shell">
          <nav aria-label="breadcrumb" className="mb-4">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <Link to="/">Homepage</Link>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Management
              </li>
            </ol>
          </nav>

          <div className="ps-management-heading">
            <div>
              <h1>Management</h1>
              <p>Admin controls for staff accounts and access.</p>
            </div>
            <Button variant="outline-primary" onClick={loadUsers} disabled={isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {pageError && <Alert variant="danger">{pageError}</Alert>}

          <Row className="g-4">
            <Col lg={5}>
              <Card className="ps-management-card">
                <Card.Body>
                  <h2>Create Staff Account</h2>
                  {createStaffError && <Alert variant="danger" className="py-2">{createStaffError}</Alert>}
                  {createStaffMessage && <Alert variant="success" className="py-2">{createStaffMessage}</Alert>}
                  <Form onSubmit={handleCreateStaff}>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>First name</Form.Label>
                          <Form.Control
                            value={formData.first_name}
                            onChange={(event) => updateField('first_name', event.target.value)}
                            required
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Last name</Form.Label>
                          <Form.Control
                            value={formData.last_name}
                            onChange={(event) => updateField('last_name', event.target.value)}
                            required
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Form.Group className="mb-3">
                      <Form.Label>Middle name</Form.Label>
                      <Form.Control
                        value={formData.middle_name}
                        onChange={(event) => updateField('middle_name', event.target.value)}
                      />
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
                      <Form.Label>Phone</Form.Label>
                      <Form.Control
                        value={formData.phone}
                        onChange={(event) => updateField('phone', event.target.value)}
                      />
                    </Form.Group>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Role</Form.Label>
                          <Form.Select
                            value={formData.role}
                            onChange={(event) => updateField('role', event.target.value)}
                          >
                            <option value="officer">Officer</option>
                            <option value="admin">Admin</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Password</Form.Label>
                          <Form.Control
                            type="password"
                            value={formData.password}
                            onChange={(event) => updateField('password', event.target.value)}
                            minLength={6}
                            required
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Creating...' : 'Create Staff'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={7}>
              <Card className="ps-management-card">
                <Card.Body>
                  <div className="ps-management-card-heading">
                    <div>
                      <h2>Staff Access</h2>
                      <p>Select a staff member to remove access or delete the account.</p>
                    </div>
                  </div>
                  {staffAccessError && <Alert variant="danger" className="py-2">{staffAccessError}</Alert>}
                  {staffAccessMessage && <Alert variant="success" className="py-2">{staffAccessMessage}</Alert>}
                  <div className="table-responsive">
                    <Table hover className="align-middle ps-management-table mb-0">
                      <thead>
                        <tr>
                          <th>Staff Member</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffUsers.length ? (
                          staffUsers.map((user) => {
                            const isSelf = user.user_id === currentUser.user_id
                            const isWorking = actionUserId === user.user_id

                            return (
                              <tr key={user.user_id}>
                                <td>
                                  <strong>{user.full_name || `${user.first_name} ${user.last_name}`}</strong>
                                  <span>{user.email}</span>
                                </td>
                                <td>{formatRole(user.role)}</td>
                                <td>{formatRole(user.verification_status)}</td>
                                <td>
                                  <div className="ps-management-actions">
                                    <Button
                                      size="sm"
                                      variant="outline-warning"
                                      disabled={isSelf || isWorking}
                                      onClick={() => handleRevokeAccess(user)}
                                    >
                                      {isWorking ? 'Saving...' : 'Remove Access'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline-danger"
                                      disabled={isSelf || isWorking}
                                      onClick={() => handleDeleteStaff(user)}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td colSpan="4" className="text-center text-muted py-4">
                              No staff accounts found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="ps-management-card ps-member-code-card mt-4">
            <Card.Body>
              <div className="ps-management-card-heading">
                <div>
                  <h2>Member Lookup</h2>
                  <p>Enter the member ID to review, update, or delete that member account.</p>
                </div>
              </div>

              <Form onSubmit={handleLookupMember} className="ps-member-code-form">
                <Form.Group className="mb-0">
                  <Form.Label>Member ID</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>PS-MEM-</InputGroup.Text>
                    <Form.Control
                      value={cleanMemberIdNumber(memberId)}
                      onChange={(event) => setMemberId(buildMemberId(event.target.value))}
                      placeholder="000000"
                    />
                  </InputGroup>
                </Form.Group>
                <Button type="submit" disabled={isSearchingMember}>
                  {isSearchingMember ? 'Searching...' : 'Find Member'}
                </Button>
              </Form>

              {memberLookupError && <Alert variant="danger" className="mt-3 mb-0">{memberLookupError}</Alert>}
              {memberActionMessage && <Alert variant="success" className="mt-3 mb-0">{memberActionMessage}</Alert>}

              {memberLookup && (
                <div className="ps-member-lookup-result">
                  <div className="ps-member-lookup-summary">
                    <div>
                      <span>Member ID</span>
                      <strong>{memberLookup.user.member_id || 'Not assigned'}</strong>
                    </div>
                    <div>
                      <span>Review Status</span>
                      <strong>{formatRole(memberLookup.verification.status)}</strong>
                    </div>
                    <div>
                      <span>Account Status</span>
                      <strong>{formatRole(memberLookup.user.verification_status)}</strong>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <Table bordered className="ps-management-table ps-member-detail-table mb-0">
                      <tbody>
                        <tr>
                          <th>Member</th>
                          <td>{memberLookup.user.full_name || `${memberLookup.user.first_name} ${memberLookup.user.last_name}`}</td>
                          <th>Email</th>
                          <td>{memberLookup.user.email}</td>
                        </tr>
                        <tr>
                          <th>Phone</th>
                          <td>{memberLookup.user.phone || 'Not provided'}</td>
                          <th>National ID</th>
                          <td>{memberLookup.user.national_id_number || 'Not provided'}</td>
                        </tr>
                        <tr>
                          <th>Role</th>
                          <td>{formatRole(memberLookup.user.role)}</td>
                          <th>Created</th>
                          <td>{formatDisplayDate(memberLookup.user.created_at)}</td>
                        </tr>
                      </tbody>
                    </Table>
                  </div>

                  <Form onSubmit={handleSaveMemberData} className="ps-member-data-form">
                    <h3>Manage Member Data</h3>
                    <div className="ps-member-data-grid">
                      <Form.Group>
                        <Form.Label>First name</Form.Label>
                        <Form.Control
                          value={memberForm.first_name}
                          onChange={(event) => updateMemberField('first_name', event.target.value)}
                          required
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Middle name</Form.Label>
                        <Form.Control
                          value={memberForm.middle_name}
                          onChange={(event) => updateMemberField('middle_name', event.target.value)}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Last name</Form.Label>
                        <Form.Control
                          value={memberForm.last_name}
                          onChange={(event) => updateMemberField('last_name', event.target.value)}
                          required
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Father name</Form.Label>
                        <Form.Control
                          value={memberForm.father_name}
                          onChange={(event) => updateMemberField('father_name', event.target.value)}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Mother name</Form.Label>
                        <Form.Control
                          value={memberForm.mother_name}
                          onChange={(event) => updateMemberField('mother_name', event.target.value)}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Date of birth</Form.Label>
                        <Form.Control
                          type="date"
                          value={memberForm.date_of_birth}
                          onChange={(event) => updateMemberField('date_of_birth', event.target.value)}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Place of birth</Form.Label>
                        <Form.Select
                          value={memberForm.place_of_birth}
                          onChange={(event) => updateMemberField('place_of_birth', event.target.value)}
                        >
                          <option value="">Select place of birth</option>
                          {LEBANESE_VILLAGE_OPTIONS.map((village) => (
                            <option key={village} value={village}>{village}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Phone</Form.Label>
                        <Form.Control
                          value={memberForm.phone}
                          onChange={(event) => updateMemberField('phone', event.target.value)}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>National ID</Form.Label>
                        <Form.Control
                          value={memberForm.national_id_number}
                          onChange={(event) => updateMemberField('national_id_number', event.target.value)}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Gender</Form.Label>
                        <Form.Select
                          value={memberForm.gender}
                          onChange={(event) => updateMemberField('gender', event.target.value)}
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </Form.Select>
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Governorate</Form.Label>
                        <Form.Select
                          value={memberForm.governorate}
                          onChange={(event) => updateMemberField('governorate', event.target.value)}
                        >
                          <option value="">Select governorate</option>
                          {governorateOptions.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Blood type</Form.Label>
                        <Form.Select
                          value={memberForm.blood_type}
                          onChange={(event) => updateMemberField('blood_type', event.target.value)}
                        >
                          {bloodTypeOptions.map(([value, label]) => (
                            <option key={value || label} value={value}>{label}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Marital status</Form.Label>
                        <Form.Select
                          value={memberForm.marital_status}
                          onChange={(event) => updateMemberField('marital_status', event.target.value)}
                        >
                          <option value="">Select status</option>
                          <option value="single">Single</option>
                          <option value="married">Married</option>
                          <option value="divorced">Divorced</option>
                          <option value="widowed">Widowed</option>
                        </Form.Select>
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Registry number</Form.Label>
                        <Form.Control
                          value={memberForm.registry_number}
                          onChange={(event) => updateMemberField('registry_number', event.target.value)}
                        />
                      </Form.Group>
                    </div>
                    <div className="ps-member-lookup-actions">
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isSavingMember || ['admin', 'officer'].includes(memberLookup.user.role)}
                      >
                        {isSavingMember ? 'Saving...' : 'Save Member Data'}
                      </Button>
                    </div>
                  </Form>

                  <div className="ps-member-lookup-actions">
                    <Button
                      variant="outline-danger"
                      disabled={isDeletingMember || ['admin', 'officer'].includes(memberLookup.user.role)}
                      onClick={handleDeleteMember}
                    >
                      {isDeletingMember ? 'Deleting...' : 'Delete Member Account'}
                    </Button>
                    {['admin', 'officer'].includes(memberLookup.user.role) && (
                      <span className="text-muted small">
                        Staff accounts must be managed from Staff Access.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
      </Container>
    </div>
  )
}

export default ManagementPage

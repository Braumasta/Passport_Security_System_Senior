import { apiRequest } from './apiClient'

export const loginUser = (credentials) =>
  apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
  })

export const registerUser = (userData) =>
  apiRequest('/auth/register', {
    method: 'POST',
    body: userData,
  })

export const verifyEmailAddress = ({ email, code }) =>
  apiRequest('/auth/verify-email', {
    method: 'POST',
    body: { email, code },
  })

export const resendVerificationEmail = (email) =>
  apiRequest('/auth/resend-verification', {
    method: 'POST',
    body: { email },
  })

export const requestPasswordReset = (email) =>
  apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  })

export const resetPassword = ({ email, code, password }) =>
  apiRequest('/auth/reset-password', {
    method: 'POST',
    body: { email, code, password },
  })

export const createApplicant = (applicantData, token) =>
  apiRequest('/applicants', {
    method: 'POST',
    body: applicantData,
    token,
  })

export const createPassportApplication = (applicationData, token) =>
  apiRequest('/applications', {
    method: 'POST',
    body: applicationData,
    token,
  })

export const addApplicationDocument = (applicationId, documentData, token) =>
  apiRequest(`/applications/${applicationId}/documents`, {
    method: 'POST',
    body: documentData,
    token,
  })

export const getApplications = (token, filters = {}) => {
  const params = new URLSearchParams()

  if (filters.search) {
    params.set('search', filters.search)
  }

  if (filters.status) {
    params.set('status', filters.status)
  }

  if (filters.memberId) {
    params.set('memberId', filters.memberId)
  }
  if (filters.verificationCode) {
    params.set('verificationCode', filters.verificationCode)
  }

  const suffix = params.toString() ? `?${params.toString()}` : ''

  return apiRequest(`/applications${suffix}`, {
    token,
  })
}

export const getApplicationById = (applicationId, token) =>
  apiRequest(`/applications/${applicationId}`, {
    token,
  })

export const updateApplicationStatus = (applicationId, payload, token) =>
  apiRequest(`/applications/${applicationId}/status`, {
    method: 'PATCH',
    body: payload,
    token,
  })

export const runApplicationAiReview = (applicationId, token) =>
  apiRequest(`/applications/${applicationId}/ai-review`, {
    method: 'POST',
    token,
  })

export const cancelApplication = (applicationId, payload, token) =>
  apiRequest(`/applications/${applicationId}/cancel`, {
    method: 'POST',
    body: payload,
    token,
  })

export const issuePassport = (payload, token) =>
  apiRequest('/passports', {
    method: 'POST',
    body: payload,
    token,
  })

export const getPassports = (token) =>
  apiRequest('/passports', {
    token,
  })

export const getCurrentUser = (token) =>
  apiRequest('/users/me', {
    token,
  })

export const updateCurrentUserDetails = (userData, token) =>
  apiRequest('/users/me', {
    method: 'PATCH',
    body: userData,
    token,
  })

export const getUsers = (token) =>
  apiRequest('/users', {
    token,
  })

export const createStaffUser = (userData, token) =>
  apiRequest('/users', {
    method: 'POST',
    body: userData,
    token,
  })

export const revokeStaffAccess = (userId, token) =>
  apiRequest(`/users/${userId}/revoke-staff-access`, {
    method: 'PATCH',
    token,
  })

export const deleteStaffUser = (userId, token) =>
  apiRequest(`/users/${userId}`, {
    method: 'DELETE',
    token,
  })

export const lookupMemberByMemberId = (memberId, token) =>
  apiRequest(`/users/member-lookup?memberId=${encodeURIComponent(memberId)}`, {
    token,
  })

export const deleteMemberByMemberId = (memberId, token) =>
  apiRequest(`/users/member-lookup/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
    token,
  })

export const updateMemberByMemberId = (memberId, userData, token) =>
  apiRequest(`/users/member-lookup/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    body: userData,
    token,
  })

export const updateProfilePhoto = (formData, token) =>
  apiRequest('/users/me/profile-photo', {
    method: 'PATCH',
    body: formData,
    token,
  })

export const submitAccountVerificationFiles = (formData, token) =>
  apiRequest('/users/me/verification-files', {
    method: 'POST',
    body: formData,
    token,
  })

export const requestChangePasswordCode = (token) =>
  apiRequest('/users/me/change-password/request-code', {
    method: 'POST',
    token,
  })

export const changePasswordFromAccount = ({ code, new_password }, token) =>
  apiRequest('/users/me/change-password', {
    method: 'POST',
    body: { code, new_password },
    token,
  })

export const getAccountVerificationReviews = (token, filters = {}) => {
  const params = new URLSearchParams()

  if (filters.status) {
    params.set('status', filters.status)
  }

  const suffix = params.toString() ? `?${params.toString()}` : ''

  return apiRequest(`/users/account-verifications${suffix}`, {
    token,
  })
}

export const getAccountVerificationReviewById = (accountVerificationId, token) =>
  apiRequest(`/users/account-verifications/${accountVerificationId}`, {
    token,
  })

export const decideAccountVerificationReview = (accountVerificationId, payload, token) =>
  apiRequest(`/users/account-verifications/${accountVerificationId}/decision`, {
    method: 'PATCH',
    body: payload,
    token,
  })

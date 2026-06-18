import { Router } from 'express';
import {
  changeCurrentUserPassword,
  createUser,
  decideAccountVerification,
  deleteUser,
  deleteMemberByMemberId,
  getAccountVerificationById,
  getCurrentUser,
  lookupMemberByMemberId,
  listAccountVerifications,
  listUsers,
  revokeStaffAccess,
  requestCurrentUserPasswordChangeCode,
  runUserAiVerification,
  submitCurrentUserVerificationFiles,
  updateCurrentUserDetails,
  updateMemberByMemberId,
  updateCurrentUserProfilePhoto,
  updateUserVerificationStatus,
} from '../controllers/userController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { accountVerificationUpload, profilePhotoUpload } from '../middleware/uploadMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  addError,
  isInEnum,
  isNonEmptyString,
  isOptionalString,
  isPositiveInteger,
  isValidDate,
  isValidEmail,
} from '../utils/validation.js';

const router = Router();
const allowedRoles = ['admin', 'officer', 'applicant'];
const allowedVerificationStatuses = ['pending', 'under_review', 'verified', 'rejected'];
const allowedGovernorates = [
  'beirut',
  'mount_lebanon',
  'north_lebanon',
  'akkar',
  'beqaa',
  'baalbek_hermel',
  'south_lebanon',
  'nabatieh',
];

const validateCreateUser = (req) => {
  const errors = [];
  const {
    first_name,
    middle_name,
    last_name,
    father_name,
    mother_name,
    date_of_birth,
    place_of_birth,
    email,
    phone,
    national_id_number,
    gender,
    governorate,
    blood_type,
    marital_status,
    registry_number,
    password,
    role,
    applicant_id,
    verification_status,
  } = req.body;

  if (!isNonEmptyString(first_name)) {
    addError(errors, 'first_name', 'First name is required');
  }

  if (!isOptionalString(middle_name)) {
    addError(errors, 'middle_name', 'Middle name must be a string');
  }

  if (!isNonEmptyString(last_name)) {
    addError(errors, 'last_name', 'Last name is required');
  }

  if (!isOptionalString(father_name)) {
    addError(errors, 'father_name', 'Father name must be a string');
  }

  if (!isOptionalString(mother_name)) {
    addError(errors, 'mother_name', 'Mother name must be a string');
  }

  if (date_of_birth !== undefined && date_of_birth !== null && !isValidDate(date_of_birth)) {
    addError(errors, 'date_of_birth', 'Date of birth must be a valid date');
  }

  if (!isOptionalString(place_of_birth)) {
    addError(errors, 'place_of_birth', 'Place of birth must be a string');
  }

  if (!isValidEmail(email)) {
    addError(errors, 'email', 'A valid email address is required');
  }

  if (phone !== undefined && phone !== null && !isNonEmptyString(phone)) {
    addError(errors, 'phone', 'Phone number must be a non-empty string');
  }

  if (national_id_number !== undefined && national_id_number !== null && !isNonEmptyString(national_id_number)) {
    addError(errors, 'national_id_number', 'National ID number must be a non-empty string');
  }

  if (gender !== undefined && gender !== null && !isInEnum(gender, ['male', 'female', 'other'])) {
    addError(errors, 'gender', 'Gender must be male, female, or other');
  }

  if (governorate !== undefined && governorate !== null && !isInEnum(governorate, allowedGovernorates)) {
    addError(errors, 'governorate', 'Governorate must be a valid governorate');
  }

  if (!isOptionalString(blood_type)) {
    addError(errors, 'blood_type', 'Blood type must be a string');
  }

  if (!isOptionalString(marital_status)) {
    addError(errors, 'marital_status', 'Marital status must be a string');
  }

  if (!isOptionalString(registry_number)) {
    addError(errors, 'registry_number', 'Registry number must be a string');
  }

  if (!isNonEmptyString(password) || password.trim().length < 6) {
    addError(errors, 'password', 'Password must be at least 6 characters long');
  }

  if (!allowedRoles.includes(role)) {
    addError(errors, 'role', 'Role must be admin, officer, or applicant');
  }

  if (applicant_id !== undefined && applicant_id !== null && !isPositiveInteger(applicant_id)) {
    addError(errors, 'applicant_id', 'Applicant ID must be a positive integer');
  }

  if (applicant_id && role !== 'applicant') {
    addError(errors, 'applicant_id', 'Only applicant users can be linked to an applicant profile');
  }

  if (
    verification_status !== undefined &&
    !isInEnum(verification_status, allowedVerificationStatuses)
  ) {
    addError(
      errors,
      'verification_status',
      'Verification status must be pending, under_review, verified, or rejected'
    );
  }

  return errors;
};

const validateVerificationStatusUpdate = (req) => {
  const errors = [];
  const { verification_status, verification_review_notes } = req.body;

  if (!isPositiveInteger(req.params.id)) {
    addError(errors, 'id', 'User ID must be a positive integer');
  }

  if (!isInEnum(verification_status, allowedVerificationStatuses)) {
    addError(
      errors,
      'verification_status',
      'Verification status must be pending, under_review, verified, or rejected'
    );
  }

  if (!isOptionalString(verification_review_notes)) {
    addError(errors, 'verification_review_notes', 'Verification review notes must be a string');
  }

  return errors;
};

const validateVerificationStatusUpdateIdOnly = (req) => {
  const errors = [];

  if (!isPositiveInteger(req.params.id)) {
    addError(errors, 'id', 'User ID must be a positive integer');
  }

  return errors;
};

const validateUpdateCurrentUserDetails = (req) => {
  const errors = [];
  const {
    first_name,
    middle_name,
    last_name,
    father_name,
    mother_name,
    date_of_birth,
    place_of_birth,
    phone,
    national_id_number,
    gender,
    governorate,
    blood_type,
    marital_status,
    registry_number,
  } = req.body;

  if (!isNonEmptyString(first_name)) {
    addError(errors, 'first_name', 'First name is required');
  }

  if (!isOptionalString(middle_name)) {
    addError(errors, 'middle_name', 'Middle name must be a string');
  }

  if (!isNonEmptyString(last_name)) {
    addError(errors, 'last_name', 'Last name is required');
  }

  if (!isOptionalString(father_name)) {
    addError(errors, 'father_name', 'Father name must be a string');
  }

  if (!isOptionalString(mother_name)) {
    addError(errors, 'mother_name', 'Mother name must be a string');
  }

  if (date_of_birth !== undefined && date_of_birth !== null && date_of_birth !== '' && !isValidDate(date_of_birth)) {
    addError(errors, 'date_of_birth', 'Date of birth must be a valid date');
  }

  if (!isOptionalString(place_of_birth)) {
    addError(errors, 'place_of_birth', 'Place of birth must be a string');
  }

  if (phone !== undefined && phone !== null && phone !== '' && !isNonEmptyString(phone)) {
    addError(errors, 'phone', 'Phone number must be a non-empty string');
  }

  if (phone && !/^\+961\d{8}$/.test(phone.trim())) {
    addError(errors, 'phone', 'Phone number must start with +961 followed by 8 digits');
  }

  if (
    national_id_number !== undefined &&
    national_id_number !== null &&
    national_id_number !== '' &&
    !isNonEmptyString(national_id_number)
  ) {
    addError(errors, 'national_id_number', 'National ID number must be a non-empty string');
  }

  if (gender !== undefined && gender !== null && gender !== '' && !isInEnum(gender, ['male', 'female', 'other'])) {
    addError(errors, 'gender', 'Gender must be male, female, or other');
  }

  if (
    governorate !== undefined &&
    governorate !== null &&
    governorate !== '' &&
    !isInEnum(governorate, allowedGovernorates)
  ) {
    addError(errors, 'governorate', 'Governorate must be a valid governorate');
  }

  if (!isOptionalString(blood_type)) {
    addError(errors, 'blood_type', 'Blood type must be a string');
  }

  if (!isOptionalString(marital_status)) {
    addError(errors, 'marital_status', 'Marital status must be a string');
  }

  if (!isOptionalString(registry_number)) {
    addError(errors, 'registry_number', 'Registry number must be a string');
  }

  return errors;
};

const validateMemberIdParam = (req) => {
  const errors = [];

  if (!isNonEmptyString(req.params.memberId)) {
    addError(errors, 'memberId', 'Member ID is required');
  }

  return errors;
};

const validateUpdateMemberByMemberId = (req) => [
  ...validateMemberIdParam(req),
  ...validateUpdateCurrentUserDetails(req),
];

const validateAccountVerificationId = (req) => {
  const errors = [];

  if (!isPositiveInteger(req.params.accountVerificationId)) {
    addError(errors, 'accountVerificationId', 'Account verification ID must be a positive integer');
  }

  return errors;
};

const validateAccountVerificationDecision = (req) => {
  const errors = validateAccountVerificationId(req);
  const { decision, notes } = req.body;

  if (!isInEnum(decision, ['accept', 'reject'])) {
    addError(errors, 'decision', 'Decision must be accept or reject');
  }

  if (!isOptionalString(notes)) {
    addError(errors, 'notes', 'Decision notes must be a string');
  }

  return errors;
};

const validateChangeCurrentUserPassword = (req) => {
  const errors = [];
  const { code, new_password } = req.body;

  if (!isNonEmptyString(code) || code.trim().length !== 8) {
    addError(errors, 'code', 'A valid 8-digit password change code is required');
  }

  if (!isNonEmptyString(new_password) || new_password.trim().length < 6) {
    addError(errors, 'new_password', 'New password must be at least 6 characters long');
  }

  return errors;
};

router.use(authenticate);

router.get('/me', getCurrentUser);
router.patch('/me', validateRequest(validateUpdateCurrentUserDetails), updateCurrentUserDetails);
router.patch('/me/profile-photo', profilePhotoUpload, updateCurrentUserProfilePhoto);
router.post('/me/verification-files', accountVerificationUpload, submitCurrentUserVerificationFiles);
router.post('/me/change-password/request-code', requestCurrentUserPasswordChangeCode);
router.post('/me/change-password', validateRequest(validateChangeCurrentUserPassword), changeCurrentUserPassword);

router.get('/account-verifications', authorizeRoles('admin', 'officer'), listAccountVerifications);
router.get(
  '/account-verifications/:accountVerificationId',
  authorizeRoles('admin', 'officer'),
  validateRequest(validateAccountVerificationId),
  getAccountVerificationById
);
router.patch(
  '/account-verifications/:accountVerificationId/decision',
  authorizeRoles('admin', 'officer'),
  validateRequest(validateAccountVerificationDecision),
  decideAccountVerification
);

router.use(authorizeRoles('admin'));

router.get('/', listUsers);
router.post('/', validateRequest(validateCreateUser), createUser);
router.get('/member-lookup', lookupMemberByMemberId);
router.patch(
  '/member-lookup/:memberId',
  validateRequest(validateUpdateMemberByMemberId),
  updateMemberByMemberId
);
router.delete(
  '/member-lookup/:memberId',
  validateRequest(validateMemberIdParam),
  deleteMemberByMemberId
);
router.post('/:id/ai-verification', validateRequest(validateVerificationStatusUpdateIdOnly), runUserAiVerification);
router.patch('/:id/verification', validateRequest(validateVerificationStatusUpdate), updateUserVerificationStatus);
router.patch('/:id/revoke-staff-access', validateRequest(validateVerificationStatusUpdateIdOnly), revokeStaffAccess);
router.delete('/:id', validateRequest(validateVerificationStatusUpdateIdOnly), deleteUser);

export default router;

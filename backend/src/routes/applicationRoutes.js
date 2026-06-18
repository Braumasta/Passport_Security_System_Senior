import { Router } from 'express';
import {
  addDocumentMetadata,
  cancelApplication,
  createApplication,
  getApplicationById,
  listApplications,
  reviewApplicationAi,
  updateApplicationStatus,
} from '../controllers/applicationController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { applicationDocumentUpload } from '../middleware/uploadMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  addError,
  isInEnum,
  isNonEmptyString,
  isOptionalString,
  isPositiveInteger,
  isValidDate,
} from '../utils/validation.js';

const router = Router();
const allowedApplicationTypes = ['first_time', 'renewal', 'renewal_lost'];
const allowedPassportTypes = ['5_year', '10_year'];
const allowedApplicationStatuses = ['pending_ai_review', 'ai_verified', 'ai_rejected'];
const allowedVerificationStatuses = ['pending', 'verified', 'rejected'];

const validateApplicationId = (req) => {
  const errors = [];

  if (!isPositiveInteger(req.params.id)) {
    addError(errors, 'id', 'Application ID must be a positive integer');
  }

  return errors;
};

const validateCreateApplication = (req) => {
  const errors = [];
  const {
    applicant_id,
    application_type = 'first_time',
    passport_type,
    passport_number,
    can_number,
    registry_place,
    registry_number,
    profession,
    issuance_date,
    expiry_date,
    notes,
  } = req.body;

  if (applicant_id !== undefined && applicant_id !== null && !isPositiveInteger(applicant_id)) {
    addError(errors, 'applicant_id', 'Applicant ID must be a positive integer');
  }

  if (!isInEnum(application_type, allowedApplicationTypes)) {
    addError(errors, 'application_type', 'Application type must be first_time, renewal, or renewal_lost');
  }

  if (!isInEnum(passport_type, allowedPassportTypes)) {
    addError(errors, 'passport_type', 'Passport type must be 5_year or 10_year');
  }

  if (!isOptionalString(passport_number)) {
    addError(errors, 'passport_number', 'Passport number must be a string');
  }

  if (application_type === 'renewal' && !isNonEmptyString(passport_number)) {
    addError(errors, 'passport_number', 'Passport number is required for renewal applications');
  }

  if (application_type === 'renewal' && !isNonEmptyString(can_number)) {
    addError(errors, 'can_number', 'CAN is required');
  }

  if (application_type === 'renewal' && !isNonEmptyString(registry_place)) {
    addError(errors, 'registry_place', 'Registry place is required');
  }

  if (!isNonEmptyString(registry_number)) {
    addError(errors, 'registry_number', 'Registry number is required');
  }

  if (issuance_date !== undefined && issuance_date !== null && issuance_date !== '' && !isValidDate(issuance_date)) {
    addError(errors, 'issuance_date', 'Issuance date must be a valid date');
  }

  if (expiry_date !== undefined && expiry_date !== null && expiry_date !== '' && !isValidDate(expiry_date)) {
    addError(errors, 'expiry_date', 'Expiry date must be a valid date');
  }

  if (application_type === 'renewal') {
    if (!issuance_date) {
      addError(errors, 'issuance_date', 'Issuance date is required for renewal applications');
    }

    if (!expiry_date) {
      addError(errors, 'expiry_date', 'Expiry date is required for renewal applications');
    }
  }

  if (
    isValidDate(issuance_date) &&
    isValidDate(expiry_date) &&
    new Date(expiry_date) <= new Date(issuance_date)
  ) {
    addError(errors, 'expiry_date', 'Expiry date must be after the issuance date');
  }

  if (!isOptionalString(notes)) {
    addError(errors, 'notes', 'Notes must be a string');
  }

  return errors;
};

const validateStatusUpdate = (req) => {
  const errors = [];
  const { status, notes } = req.body;

  if (!isInEnum(status, allowedApplicationStatuses)) {
    addError(errors, 'status', 'Status must be under_review, approved, or rejected');
  }

  if (!isOptionalString(notes)) {
    addError(errors, 'notes', 'Notes must be a string');
  }

  return errors;
};

const validateDecision = (req) => {
  const errors = [];
  const { cancellation_reason } = req.body;

  if (!isOptionalString(cancellation_reason)) {
    addError(errors, 'cancellation_reason', 'Cancellation reason must be a string');
  }

  return errors;
};

const validateAddDocument = (req) => {
  const errors = [];
  const { document_type, file_name, file_path, verification_status } = req.body;

  if (!isNonEmptyString(document_type)) {
    addError(errors, 'document_type', 'Document type is required');
  }

  if (!req.file && !isNonEmptyString(file_name)) {
    addError(errors, 'file_name', 'File name is required');
  }

  if (!req.file && !isNonEmptyString(file_path)) {
    addError(errors, 'file_path', 'File path is required');
  }

  if (
    verification_status !== undefined &&
    !isInEnum(verification_status, allowedVerificationStatuses)
  ) {
    addError(errors, 'verification_status', 'Verification status must be pending, verified, or rejected');
  }

  return errors;
};

router.use(authenticate);

router.get('/', authorizeRoles('admin', 'officer'), listApplications);
router.post('/', validateRequest(validateCreateApplication), createApplication);
router.get(
  '/:id',
  authorizeRoles('admin', 'officer'),
  validateRequest(validateApplicationId),
  getApplicationById
);

router.patch(
  '/:id/status',
  authorizeRoles('admin', 'officer'),
  validateRequest(validateApplicationId),
  validateRequest(validateStatusUpdate),
  updateApplicationStatus
);

router.post(
  '/:id/ai-review',
  authorizeRoles('admin', 'officer'),
  validateRequest(validateApplicationId),
  reviewApplicationAi
);

router.post(
  '/:id/documents',
  applicationDocumentUpload,
  validateRequest(validateApplicationId),
  validateRequest(validateAddDocument),
  addDocumentMetadata
);

router.post(
  '/:id/cancel',
  authorizeRoles('admin', 'officer'),
  validateRequest(validateApplicationId),
  validateRequest(validateDecision),
  cancelApplication
);

export default router;

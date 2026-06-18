import { Router } from 'express';
import {
  getPassportById,
  issuePassport,
  listPassports,
} from '../controllers/passportController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  addError,
  isInEnum,
  isNonEmptyString,
  isPositiveInteger,
  isValidDate,
} from '../utils/validation.js';

const router = Router();
const allowedPassportStatuses = ['active', 'expired', 'cancelled'];

const validatePassportId = (req) => {
  const errors = [];

  if (!isPositiveInteger(req.params.id)) {
    addError(errors, 'id', 'Passport ID must be a positive integer');
  }

  return errors;
};

const validateIssuePassport = (req) => {
  const errors = [];
  const { application_id, passport_number, issue_date, expiry_date, issuing_authority, passport_status } =
    req.body;

  if (!isPositiveInteger(application_id)) {
    addError(errors, 'application_id', 'Application ID must be a positive integer');
  }

  if (!isNonEmptyString(passport_number)) {
    addError(errors, 'passport_number', 'Passport number is required');
  }

  if (!isValidDate(issue_date)) {
    addError(errors, 'issue_date', 'Issue date must be a valid date');
  }

  if (!isValidDate(expiry_date)) {
    addError(errors, 'expiry_date', 'Expiry date must be a valid date');
  }

  if (isValidDate(issue_date) && isValidDate(expiry_date) && new Date(expiry_date) <= new Date(issue_date)) {
    addError(errors, 'expiry_date', 'Expiry date must be after the issue date');
  }

  if (!isNonEmptyString(issuing_authority)) {
    addError(errors, 'issuing_authority', 'Issuing authority is required');
  }

  if (passport_status !== undefined && !isInEnum(passport_status, allowedPassportStatuses)) {
    addError(errors, 'passport_status', 'Passport status must be active, expired, or cancelled');
  }

  return errors;
};

router.use(authenticate);

router.get('/', listPassports);
router.get('/:id', validateRequest(validatePassportId), getPassportById);
router.post(
  '/',
  authorizeRoles('admin', 'officer'),
  validateRequest(validateIssuePassport),
  issuePassport
);

export default router;

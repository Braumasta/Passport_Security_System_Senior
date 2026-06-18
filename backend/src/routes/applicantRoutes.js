import { Router } from 'express';
import {
  createApplicant,
  getApplicantById,
  listApplicants,
} from '../controllers/applicantController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  addError,
  isInEnum,
  isNonEmptyString,
  isPositiveInteger,
  isValidDate,
  isValidEmail,
} from '../utils/validation.js';

const router = Router();
const allowedGenders = ['male', 'female', 'other'];

const validateApplicantId = (req) => {
  const errors = [];

  if (!isPositiveInteger(req.params.id)) {
    addError(errors, 'id', 'Applicant ID must be a positive integer');
  }

  return errors;
};

const validateCreateApplicant = (req) => {
  const errors = [];
  const {
    first_name,
    last_name,
    father_name,
    mother_name,
    date_of_birth,
    place_of_birth,
    gender,
    nationality,
    national_id_number,
    phone,
    email,
    address,
  } = req.body;

  if (!isNonEmptyString(first_name)) {
    addError(errors, 'first_name', 'First name is required');
  }

  if (!isNonEmptyString(last_name)) {
    addError(errors, 'last_name', 'Last name is required');
  }

  if (!isNonEmptyString(father_name)) {
    addError(errors, 'father_name', 'Father name is required');
  }

  if (!isNonEmptyString(mother_name)) {
    addError(errors, 'mother_name', 'Mother name is required');
  }

  if (!isValidDate(date_of_birth)) {
    addError(errors, 'date_of_birth', 'Date of birth must be a valid date');
  }

  if (!isNonEmptyString(place_of_birth)) {
    addError(errors, 'place_of_birth', 'Place of birth is required');
  }

  if (!isInEnum(gender, allowedGenders)) {
    addError(errors, 'gender', 'Gender must be male, female, or other');
  }

  if (!isNonEmptyString(nationality)) {
    addError(errors, 'nationality', 'Nationality is required');
  }

  if (!isNonEmptyString(national_id_number)) {
    addError(errors, 'national_id_number', 'National ID number is required');
  }

  if (!isNonEmptyString(phone)) {
    addError(errors, 'phone', 'Phone is required');
  }

  if (!isValidEmail(email)) {
    addError(errors, 'email', 'A valid email address is required');
  }

  if (!isNonEmptyString(address)) {
    addError(errors, 'address', 'Address is required');
  }

  return errors;
};

router.use(authenticate);

router.get('/', listApplicants);
router.get('/:id', validateRequest(validateApplicantId), getApplicantById);
router.post('/', validateRequest(validateCreateApplicant), createApplicant);

export default router;

import { Router } from 'express';
import {
  forgotPassword,
  login,
  registerApplicant,
  resendVerificationEmail,
  resetPassword,
  verifyEmail,
} from '../controllers/authController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  addError,
  isNonEmptyString,
  isInEnum,
  isOptionalString,
  isValidDate,
  isValidEmail,
} from '../utils/validation.js';

const router = Router();
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

const validateLogin = (req) => {
  const errors = [];
  const { email, password } = req.body;

  if (!isValidEmail(email)) {
    addError(errors, 'email', 'A valid email address is required');
  }

  if (!isNonEmptyString(password)) {
    addError(errors, 'password', 'Password is required');
  }

  return errors;
};

const validateRegister = (req) => {
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

  if (!isNonEmptyString(father_name)) {
    addError(errors, 'father_name', 'Father name is required');
  }

  if (!isNonEmptyString(mother_name)) {
    addError(errors, 'mother_name', 'Mother name is required');
  }

  if (!isValidDate(date_of_birth)) {
    addError(errors, 'date_of_birth', 'A valid date of birth is required');
  }

  if (!isNonEmptyString(place_of_birth)) {
    addError(errors, 'place_of_birth', 'Place of birth is required');
  }

  if (!isValidEmail(email)) {
    addError(errors, 'email', 'A valid email address is required');
  }

  if (!isNonEmptyString(phone)) {
    addError(errors, 'phone', 'Phone number is required');
  } else if (!/^\+961\d{8}$/.test(phone.trim())) {
    addError(errors, 'phone', 'Phone number must use +961 followed by 8 digits');
  }

  if (!isNonEmptyString(national_id_number)) {
    addError(errors, 'national_id_number', 'National ID number is required');
  }

  if (!isInEnum(gender, ['male', 'female', 'other'])) {
    addError(errors, 'gender', 'Gender must be male, female, or other');
  }

  if (!isInEnum(governorate, allowedGovernorates)) {
    addError(errors, 'governorate', 'Governorate is required');
  }

  if (!isNonEmptyString(registry_number)) {
    addError(errors, 'registry_number', 'Registry number is required');
  }

  if (!isInEnum(marital_status, ['single', 'married', 'divorced', 'widowed'])) {
    addError(errors, 'marital_status', 'Marital status is required');
  }

  if (!isInEnum(blood_type, ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])) {
    addError(errors, 'blood_type', 'Blood type is required');
  }

  if (!isNonEmptyString(password) || password.trim().length < 6) {
    addError(errors, 'password', 'Password must be at least 6 characters long');
  }

  return errors;
};

const validateEmailRequest = (req) => {
  const errors = [];

  if (!isValidEmail(req.body.email)) {
    addError(errors, 'email', 'A valid email address is required');
  }

  return errors;
};

const validateVerifyEmail = (req) => {
  const errors = [];
  const { email, code } = req.body;

  if (!isValidEmail(email)) {
    addError(errors, 'email', 'A valid email address is required');
  }

  if (!isNonEmptyString(code) || code.trim().length !== 6) {
    addError(errors, 'code', 'A valid 6-digit verification code is required');
  }

  return errors;
};

const validateResetPassword = (req) => {
  const errors = [];
  const { email, code, password } = req.body;

  if (!isValidEmail(email)) {
    addError(errors, 'email', 'A valid email address is required');
  }

  if (!isNonEmptyString(code) || code.trim().length !== 8) {
    addError(errors, 'code', 'A valid 8-digit password reset code is required');
  }

  if (!isNonEmptyString(password) || password.trim().length < 6) {
    addError(errors, 'password', 'Password must be at least 6 characters long');
  }

  return errors;
};

router.post('/login', validateRequest(validateLogin), login);
router.post('/register', validateRequest(validateRegister), registerApplicant);
router.post('/verify-email', validateRequest(validateVerifyEmail), verifyEmail);
router.post('/resend-verification', validateRequest(validateEmailRequest), resendVerificationEmail);
router.post('/forgot-password', validateRequest(validateEmailRequest), forgotPassword);
router.post('/reset-password', validateRequest(validateResetPassword), resetPassword);

export default router;

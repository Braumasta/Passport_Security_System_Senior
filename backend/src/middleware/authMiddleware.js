import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authorization token is required');
  }

  const token = authHeader.split(' ')[1];
  let decodedToken;

  try {
    decodedToken = jwt.verify(token, env.jwtSecret);
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  // Read the current user from the database so role changes and applicant links stay up to date.
  const userResult = await query(
    `
      SELECT
        user_id,
        first_name,
        middle_name,
        last_name,
        father_name,
        mother_name,
        email,
        phone,
        date_of_birth,
        place_of_birth,
        national_id_number,
        gender,
        governorate,
        blood_type,
        marital_status,
        registry_number,
        profile_photo_path,
        role,
        verification_status,
        email_verified_at,
        applicant_id
      FROM users
      WHERE user_id = $1
    `,
    [decodedToken.userId]
  );

  const currentUser = userResult.rows[0];

  if (!currentUser) {
    throw new ApiError(401, 'User for this token no longer exists');
  }

  req.user = {
    userId: currentUser.user_id,
    firstName: currentUser.first_name,
    middleName: currentUser.middle_name,
    lastName: currentUser.last_name,
    fatherName: currentUser.father_name,
    motherName: currentUser.mother_name,
    email: currentUser.email,
    phone: currentUser.phone,
    dateOfBirth: currentUser.date_of_birth,
    placeOfBirth: currentUser.place_of_birth,
    nationalIdNumber: currentUser.national_id_number,
    gender: currentUser.gender,
    governorate: currentUser.governorate,
    bloodType: currentUser.blood_type,
    maritalStatus: currentUser.marital_status,
    registryNumber: currentUser.registry_number,
    profilePhotoPath: currentUser.profile_photo_path,
    role: currentUser.role,
    verificationStatus: currentUser.verification_status,
    emailVerifiedAt: currentUser.email_verified_at,
    applicantId: currentUser.applicant_id,
  };

  next();
});

export const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to access this resource'));
  }

  return next();
};

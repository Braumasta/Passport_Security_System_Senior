import pool, { query } from '../db/pool.js';
import { createAuditLog } from '../services/auditLogService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const applicantSelectQuery = `
  SELECT
    applicant_id,
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
    created_at
  FROM applicants
`;

const normalizeDateOnlyString = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      return trimmedValue;
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmedValue)) {
      return trimmedValue.slice(0, 10);
    }

    const parsedDate = new Date(trimmedValue);

    if (!Number.isNaN(parsedDate.getTime())) {
      return [
        parsedDate.getFullYear(),
        String(parsedDate.getMonth() + 1).padStart(2, '0'),
        String(parsedDate.getDate()).padStart(2, '0'),
      ].join('-');
    }

    return trimmedValue;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-');
  }

  const parsedDate = new Date(value);

  if (!Number.isNaN(parsedDate.getTime())) {
    return [
      parsedDate.getFullYear(),
      String(parsedDate.getMonth() + 1).padStart(2, '0'),
      String(parsedDate.getDate()).padStart(2, '0'),
    ].join('-');
  }

  return String(value);
};

export const listApplicants = asyncHandler(async (req, res) => {
  if (req.user.role === 'applicant') {
    if (!req.user.applicantId) {
      return res.status(200).json({ data: [] });
    }

    const applicantResult = await query(
      `${applicantSelectQuery} WHERE applicant_id = $1`,
      [req.user.applicantId]
    );

    return res.status(200).json({ data: applicantResult.rows });
  }

  const result = await query(`${applicantSelectQuery} ORDER BY applicant_id`);

  return res.status(200).json({
    data: result.rows,
  });
});

export const getApplicantById = asyncHandler(async (req, res) => {
  const applicantId = Number(req.params.id);

  if (req.user.role === 'applicant' && req.user.applicantId !== applicantId) {
    throw new ApiError(403, 'You can only view your own applicant profile');
  }

  const result = await query(`${applicantSelectQuery} WHERE applicant_id = $1`, [applicantId]);
  const applicant = result.rows[0];

  if (!applicant) {
    throw new ApiError(404, 'Applicant not found');
  }

  res.status(200).json({
    data: applicant,
  });
});

export const createApplicant = asyncHandler(async (req, res) => {
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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (req.user.role === 'applicant') {
      if (req.user.verificationStatus !== 'verified') {
        throw new ApiError(403, 'Your account must be verified before you can submit a passport application');
      }

      if (req.user.applicantId) {
        const existingApplicantResult = await client.query(
          `${applicantSelectQuery} WHERE applicant_id = $1`,
          [req.user.applicantId]
        );

        const existingApplicant = existingApplicantResult.rows[0];

        if (!existingApplicant) {
          throw new ApiError(409, 'This applicant user is already linked to an applicant profile');
        }

        await client.query('COMMIT');

        return res.status(200).json({
          message: 'Applicant profile already exists and will be reused',
          data: existingApplicant,
        });
      }

      if (req.user.nationalIdNumber && req.user.nationalIdNumber !== national_id_number) {
        throw new ApiError(400, 'National ID number must match the verified account details');
      }

      if (req.user.dateOfBirth) {
        const accountDateOfBirth = normalizeDateOnlyString(req.user.dateOfBirth);

        if (accountDateOfBirth !== normalizeDateOnlyString(date_of_birth)) {
          throw new ApiError(400, 'Date of birth must match the verified account details');
        }
      }
    }

    const createdApplicantResult = await client.query(
      `
        INSERT INTO applicants (
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
          address
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `,
      [
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
      ]
    );

    const createdApplicant = createdApplicantResult.rows[0];

    // If the logged-in user is an applicant account, link the user to the new applicant profile.
    if (req.user.role === 'applicant') {
      await client.query(
        `
          UPDATE users
          SET applicant_id = $1
          WHERE user_id = $2
        `,
        [createdApplicant.applicant_id, req.user.userId]
      );
    }

    await createAuditLog({
      userId: req.user.userId,
      action: 'CREATE_APPLICANT',
      entityType: 'applicants',
      entityId: createdApplicant.applicant_id,
      details: {
        national_id_number: createdApplicant.national_id_number,
      },
      client,
    });

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Applicant created successfully',
      data: createdApplicant,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

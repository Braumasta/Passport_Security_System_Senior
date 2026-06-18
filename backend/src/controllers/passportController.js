import pool, { query } from '../db/pool.js';
import { createAuditLog } from '../services/auditLogService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const passportBaseQuery = `
  SELECT
    pr.passport_id,
    pr.application_id,
    pr.passport_number,
    pr.issue_date,
    pr.expiry_date,
    pr.issuing_authority,
    pr.passport_status,
    pr.created_at,
    pa.application_reference,
    pa.status AS application_status,
    pa.applicant_id,
    a.first_name,
    a.last_name
  FROM passport_records pr
  JOIN passport_applications pa ON pa.application_id = pr.application_id
  JOIN applicants a ON a.applicant_id = pa.applicant_id
`;

export const listPassports = asyncHandler(async (req, res) => {
  let result;

  if (req.user.role === 'applicant') {
    if (!req.user.applicantId) {
      return res.status(200).json({ data: [] });
    }

    result = await query(
      `${passportBaseQuery} WHERE pa.applicant_id = $1 ORDER BY pr.passport_id DESC`,
      [req.user.applicantId]
    );
  } else {
    result = await query(`${passportBaseQuery} ORDER BY pr.passport_id DESC`);
  }

  res.status(200).json({
    data: result.rows,
  });
});

export const getPassportById = asyncHandler(async (req, res) => {
  const passportId = Number(req.params.id);
  const result = await query(`${passportBaseQuery} WHERE pr.passport_id = $1`, [passportId]);
  const passport = result.rows[0];

  if (!passport) {
    throw new ApiError(404, 'Passport record not found');
  }

  if (req.user.role === 'applicant' && passport.applicant_id !== req.user.applicantId) {
    throw new ApiError(403, 'You can only view your own passport record');
  }

  res.status(200).json({
    data: passport,
  });
});

export const issuePassport = asyncHandler(async (req, res) => {
  const { application_id, passport_number, issue_date, expiry_date, issuing_authority, passport_status } =
    req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const applicationResult = await client.query(
      `
        SELECT application_id, applicant_id, status
        FROM passport_applications
        WHERE application_id = $1
      `,
      [application_id]
    );

    const application = applicationResult.rows[0];

    if (!application) {
      throw new ApiError(404, 'Application not found');
    }

    if (application.status !== 'ai_verified') {
      throw new ApiError(400, 'A passport can only be issued for an AI-verified application');
    }

    const existingPassportResult = await client.query(
      `
        SELECT passport_id
        FROM passport_records
        WHERE application_id = $1
      `,
      [application_id]
    );

    if (existingPassportResult.rows[0]) {
      throw new ApiError(409, 'A passport has already been issued for this application');
    }

    const createdPassportResult = await client.query(
      `
        INSERT INTO passport_records (
          application_id,
          passport_number,
          issue_date,
          expiry_date,
          issuing_authority,
          passport_status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        application_id,
        passport_number,
        issue_date,
        expiry_date,
        issuing_authority,
        passport_status || 'active',
      ]
    );

    const createdPassport = createdPassportResult.rows[0];

    await client.query(
      `
        UPDATE passport_applications
        SET
          status = 'issued',
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE application_id = $2
      `,
      [req.user.userId, application_id]
    );

    await createAuditLog({
      userId: req.user.userId,
      action: 'ISSUE_PASSPORT',
      entityType: 'passport_records',
      entityId: createdPassport.passport_id,
      details: {
        application_id,
        passport_number,
      },
      client,
    });

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Passport issued successfully',
      data: createdPassport,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

import bcrypt from 'bcryptjs';
import pool, { query } from '../db/pool.js';
import { createAuditLog } from '../services/auditLogService.js';
import { verificationService } from '../services/verificationService.js';
import {
  createSignedStorageUrl,
  deleteSupabaseFile,
  uploadFileToSupabase,
} from '../services/supabaseStorageService.js';
import { env } from '../config/env.js';
import {
  sendAccountVerificationCompletedEmail,
  sendAccountVerificationFailedEmail,
  sendAccountVerificationSubmittedEmail,
  sendChangePasswordCodeEmail,
  sendPasswordChangedNotificationEmail,
} from '../services/emailService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateEightDigitCode, hashToken } from '../utils/tokenUtils.js';

const buildFullName = (user) =>
  [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ');

const buildAccountVerificationCode = (accountVerificationId, submittedAt = new Date()) => {
  const year = new Date(submittedAt).getFullYear();
  return `AV-${year}-${String(accountVerificationId).padStart(6, '0')}`;
};

const buildMemberId = (userId) => `PS-MEM-${String(userId).padStart(6, '0')}`;

let memberIdSchemaEnsured = false;

const ensureMemberIdSchema = async (db = { query }) => {
  if (memberIdSchemaEnsured) {
    return;
  }

  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS member_id VARCHAR(30);

    UPDATE users
    SET member_id = CONCAT('PS-MEM-', LPAD(user_id::TEXT, 6, '0'))
    WHERE role = 'applicant'
      AND member_id IS NULL;

    UPDATE users
    SET member_id = NULL
    WHERE role <> 'applicant'
      AND member_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_member_id_unique
      ON users(member_id)
      WHERE member_id IS NOT NULL;
  `);

  memberIdSchemaEnsured = true;
};

const toUserResponse = async (user) => ({
  ...user,
  full_name: buildFullName(user),
  profile_photo_path:
    (await createSignedStorageUrl(user.profile_photo_path)) || user.profile_photo_path,
});

const userSelectQuery = `
  SELECT
    user_id,
    member_id,
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
    profile_photo_path,
    profile_photo_updated_at,
    role,
    verification_status,
    email_verified_at,
    verification_review_notes,
    verification_submitted_at,
    verification_reviewed_at,
    applicant_id,
    created_at,
    (
      SELECT av.verification_code
      FROM account_verifications av
      WHERE av.user_id = users.user_id
      ORDER BY av.account_verification_id DESC
      LIMIT 1
    ) AS latest_account_verification_code
  FROM users
`;

const PASSWORD_CHANGE_TTL_MS = 1000 * 60 * 30;

const getRequiredUploadedFile = (files, fieldName) => {
  const file = files?.[fieldName]?.[0];

  if (!file) {
    throw new ApiError(400, `Missing required file: ${fieldName}`);
  }

  return file;
};

export const getCurrentUser = asyncHandler(async (req, res) => {
  await ensureMemberIdSchema();

  const result = await query(`${userSelectQuery} WHERE user_id = $1`, [req.user.userId]);
  const user = result.rows[0];

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json({
    data: await toUserResponse(user),
  });
});

export const updateCurrentUserDetails = asyncHandler(async (req, res) => {
  const {
    first_name,
    middle_name = null,
    last_name,
    father_name = null,
    mother_name = null,
    date_of_birth = null,
    place_of_birth = null,
    phone = null,
    gender = null,
    governorate = null,
    marital_status = null,
  } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updatedUserResult = await client.query(
      `
        UPDATE users
        SET
          first_name = $1,
          middle_name = $2,
          last_name = $3,
          father_name = $4,
          mother_name = $5,
          date_of_birth = $6,
          place_of_birth = $7,
          phone = $8,
          gender = $9,
          governorate = $10,
          marital_status = $11
        WHERE user_id = $12
        RETURNING
          user_id,
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
          profile_photo_path,
          profile_photo_updated_at,
          role,
          verification_status,
          email_verified_at,
          verification_review_notes,
          verification_submitted_at,
          verification_reviewed_at,
          applicant_id,
          created_at
      `,
      [
        first_name.trim(),
        middle_name?.trim() || null,
        last_name.trim(),
        father_name?.trim() || null,
        mother_name?.trim() || null,
        date_of_birth || null,
        place_of_birth?.trim() || null,
        phone?.trim() || null,
        gender || null,
        governorate || null,
        marital_status || null,
        req.user.userId,
      ]
    );

    const updatedUser = updatedUserResult.rows[0];

    if (!updatedUser) {
      throw new ApiError(404, 'User not found');
    }

    await createAuditLog({
      userId: req.user.userId,
      action: 'UPDATE_OWN_ACCOUNT_DETAILS',
      entityType: 'users',
      entityId: req.user.userId,
      details: {
        updated_email: updatedUser.email,
      },
      client,
    });

    const refreshedUserResult = await client.query(`${userSelectQuery} WHERE user_id = $1`, [
      req.user.userId,
    ]);

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Account details updated successfully',
      data: await toUserResponse(refreshedUserResult.rows[0] || updatedUser),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const listUsers = asyncHandler(async (req, res) => {
  await ensureMemberIdSchema();

  const result = await query(`${userSelectQuery} ORDER BY user_id`);

  res.status(200).json({
    data: await Promise.all(result.rows.map(toUserResponse)),
  });
});

export const createUser = asyncHandler(async (req, res) => {
  await ensureMemberIdSchema();

  const {
    first_name,
    middle_name,
    last_name,
    father_name = null,
    mother_name = null,
    date_of_birth,
    place_of_birth = null,
    email,
    phone,
    national_id_number = null,
    gender = null,
    governorate = null,
    blood_type = null,
    marital_status = null,
    registry_number = null,
    password,
    role,
    applicant_id = null,
    verification_status,
  } = req.body;

  const passwordHash = await bcrypt.hash(password, 10);
  const resolvedVerificationStatus =
    verification_status || (role === 'applicant' ? 'pending' : 'verified');
  const normalizedEmail = email.trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureMemberIdSchema(client);

    const createdUserResult = await client.query(
      `
        INSERT INTO users (
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
          password_hash,
          email_verified_at,
          role,
          verification_status,
          verification_reviewed_at,
          applicant_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING
          user_id,
          member_id,
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
          profile_photo_path,
          profile_photo_updated_at,
          role,
          verification_status,
          email_verified_at,
          verification_review_notes,
          verification_submitted_at,
          verification_reviewed_at,
          applicant_id,
          created_at
      `,
      [
        first_name,
        middle_name || null,
        last_name,
        father_name || null,
        mother_name || null,
        date_of_birth || null,
        place_of_birth || null,
        normalizedEmail,
        phone || null,
        national_id_number || null,
        gender || null,
        governorate || null,
        blood_type || null,
        marital_status || null,
        registry_number || null,
        passwordHash,
        resolvedVerificationStatus === 'verified' ? new Date() : null,
        role,
        resolvedVerificationStatus,
        resolvedVerificationStatus === 'verified' ? new Date() : null,
        applicant_id,
      ]
    );

    let createdUser = createdUserResult.rows[0];

    if (createdUser.role === 'applicant' && !createdUser.member_id) {
      const memberIdResult = await client.query(
        `
          UPDATE users
          SET member_id = $1
          WHERE user_id = $2
          RETURNING *
        `,
        [buildMemberId(createdUser.user_id), createdUser.user_id]
      );
      createdUser = memberIdResult.rows[0];
    }

    await createAuditLog({
      userId: req.user.userId,
      action: 'CREATE_USER',
      entityType: 'users',
      entityId: createdUser.user_id,
      details: {
        created_email: createdUser.email,
        created_role: createdUser.role,
      },
      client,
    });

    await client.query('COMMIT');

    res.status(201).json({
      message: 'User created successfully',
      data: await toUserResponse(createdUser),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const revokeStaffAccess = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);

  if (userId === req.user.userId) {
    throw new ApiError(400, 'You cannot revoke access for your own account');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(`${userSelectQuery} WHERE user_id = $1 FOR UPDATE`, [userId]);
    const targetUser = userResult.rows[0];

    if (!targetUser) {
      throw new ApiError(404, 'User not found');
    }

    if (!['admin', 'officer'].includes(targetUser.role)) {
      throw new ApiError(400, 'Only staff accounts can have staff access revoked');
    }

    const updatedUserResult = await client.query(
      `
        UPDATE users
        SET
          role = 'applicant',
          verification_status = 'rejected',
          verification_review_notes = 'Staff access revoked by administrator.',
          verification_reviewed_at = CURRENT_TIMESTAMP,
          applicant_id = NULL
        WHERE user_id = $1
        RETURNING
          user_id,
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
          profile_photo_path,
          profile_photo_updated_at,
          role,
          verification_status,
          email_verified_at,
          verification_review_notes,
          verification_submitted_at,
          verification_reviewed_at,
          applicant_id,
          created_at
      `,
      [userId]
    );

    await createAuditLog({
      userId: req.user.userId,
      action: 'REVOKE_STAFF_ACCESS',
      entityType: 'users',
      entityId: userId,
      details: {
        target_email: targetUser.email,
        previous_role: targetUser.role,
      },
      client,
    });

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Staff access revoked successfully',
      data: await toUserResponse(updatedUserResult.rows[0]),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const deleteUser = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);

  if (userId === req.user.userId) {
    throw new ApiError(400, 'You cannot delete your own account');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(`${userSelectQuery} WHERE user_id = $1 FOR UPDATE`, [userId]);
    const targetUser = userResult.rows[0];

    if (!targetUser) {
      throw new ApiError(404, 'User not found');
    }

    if (!['admin', 'officer'].includes(targetUser.role)) {
      throw new ApiError(400, 'Only staff accounts can be deleted from management');
    }

    await createAuditLog({
      userId: req.user.userId,
      action: 'DELETE_STAFF_ACCOUNT',
      entityType: 'users',
      entityId: userId,
      details: {
        target_email: targetUser.email,
        target_role: targetUser.role,
      },
      client,
    });

    await client.query('DELETE FROM users WHERE user_id = $1', [userId]);

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Staff account deleted successfully',
      data: { user_id: userId },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const lookupMemberByMemberId = asyncHandler(async (req, res) => {
  await ensureMemberIdSchema();

  const memberId = req.query.memberId?.trim();

  if (!memberId) {
    throw new ApiError(400, 'Member ID is required');
  }

  const result = await query(
    `
      SELECT
        av.account_verification_id,
        av.verification_code,
        av.status AS account_verification_status,
        av.ai_score,
        av.submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Beirut' AS submitted_at,
        av.reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Beirut' AS reviewed_at,
        u.user_id,
        u.member_id,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.father_name,
        u.mother_name,
        u.date_of_birth,
        u.place_of_birth,
        u.email,
        u.phone,
        u.national_id_number,
        u.gender,
        u.governorate,
        u.blood_type,
        u.marital_status,
        u.registry_number,
        u.profile_photo_path,
        u.profile_photo_updated_at,
        u.role,
        u.verification_status,
        u.email_verified_at,
        u.verification_review_notes,
        u.verification_submitted_at,
        u.verification_reviewed_at,
        u.applicant_id,
        u.created_at
      FROM users u
      LEFT JOIN LATERAL (
        SELECT *
        FROM account_verifications av
        WHERE av.user_id = u.user_id
        ORDER BY av.account_verification_id DESC
        LIMIT 1
      ) av ON true
      WHERE UPPER(u.member_id) = UPPER($1)
        AND u.role = 'applicant'
      LIMIT 1
    `,
    [memberId]
  );
  const row = result.rows[0];

  if (!row) {
    throw new ApiError(404, 'No member account was found for that member ID');
  }

  const user = await toUserResponse(row);

  res.status(200).json({
    data: {
      verification: {
        account_verification_id: row.account_verification_id,
        verification_code: row.verification_code,
        status: row.account_verification_status,
        ai_score: row.ai_score,
        submitted_at: row.submitted_at,
        reviewed_at: row.reviewed_at,
      },
      user,
    },
  });
});

export const deleteMemberByMemberId = asyncHandler(async (req, res) => {
  const memberId = req.params.memberId?.trim();

  if (!memberId) {
    throw new ApiError(400, 'Member ID is required');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureMemberIdSchema(client);

    const memberResult = await client.query(
      `
        SELECT
          u.user_id,
          u.member_id,
          u.email,
          u.role
        FROM users u
        WHERE UPPER(u.member_id) = UPPER($1)
          AND u.role = 'applicant'
        FOR UPDATE OF u
      `,
      [memberId]
    );
    const member = memberResult.rows[0];

    if (!member) {
      throw new ApiError(404, 'No member account was found for that member ID');
    }

    if (member.user_id === req.user.userId) {
      throw new ApiError(400, 'You cannot delete your own account from member management');
    }

    if (['admin', 'officer'].includes(member.role)) {
      throw new ApiError(400, 'Use Staff Access controls for staff accounts');
    }

    await createAuditLog({
      userId: req.user.userId,
      action: 'DELETE_MEMBER_BY_MEMBER_ID',
      entityType: 'users',
      entityId: member.user_id,
      details: {
        target_email: member.email,
        member_id: member.member_id,
      },
      client,
    });

    await client.query('DELETE FROM users WHERE user_id = $1', [member.user_id]);

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Member account deleted successfully',
      data: {
        user_id: member.user_id,
        member_id: member.member_id,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const updateMemberByMemberId = asyncHandler(async (req, res) => {
  const memberId = req.params.memberId?.trim();
  const {
    first_name,
    middle_name = null,
    last_name,
    father_name = null,
    mother_name = null,
    date_of_birth = null,
    place_of_birth = null,
    phone = null,
    national_id_number = null,
    gender = null,
    governorate = null,
    blood_type = null,
    marital_status = null,
    registry_number = null,
  } = req.body;

  if (!memberId) {
    throw new ApiError(400, 'Member ID is required');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureMemberIdSchema(client);

    const memberResult = await client.query(
      `
        SELECT
          u.user_id,
          u.member_id,
          u.email,
          u.role
        FROM users u
        WHERE UPPER(u.member_id) = UPPER($1)
          AND u.role = 'applicant'
        FOR UPDATE OF u
      `,
      [memberId]
    );
    const member = memberResult.rows[0];

    if (!member) {
      throw new ApiError(404, 'No member account was found for that member ID');
    }

    if (['admin', 'officer'].includes(member.role)) {
      throw new ApiError(400, 'Use Staff Access controls for staff accounts');
    }

    const updatedUserResult = await client.query(
      `
        UPDATE users
        SET
          first_name = $1,
          middle_name = $2,
          last_name = $3,
          father_name = $4,
          mother_name = $5,
          date_of_birth = $6,
          place_of_birth = $7,
          phone = $8,
          national_id_number = $9,
          gender = $10,
          governorate = $11,
          blood_type = $12,
          marital_status = $13,
          registry_number = $14
        WHERE user_id = $15
        RETURNING
          user_id,
          member_id,
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
          profile_photo_path,
          profile_photo_updated_at,
          role,
          verification_status,
          email_verified_at,
          verification_review_notes,
          verification_submitted_at,
          verification_reviewed_at,
          applicant_id,
          created_at
      `,
      [
        first_name.trim(),
        middle_name?.trim() || null,
        last_name.trim(),
        father_name?.trim() || null,
        mother_name?.trim() || null,
        date_of_birth || null,
        place_of_birth?.trim() || null,
        phone?.trim() || null,
        national_id_number?.trim() || null,
        gender || null,
        governorate || null,
        blood_type?.trim() || null,
        marital_status || null,
        registry_number?.trim() || null,
        member.user_id,
      ]
    );
    const updatedUser = updatedUserResult.rows[0];

    await createAuditLog({
      userId: req.user.userId,
      action: 'UPDATE_MEMBER_BY_MEMBER_ID',
      entityType: 'users',
      entityId: member.user_id,
      details: {
        target_email: member.email,
        member_id: member.member_id,
      },
      client,
    });

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Member account details updated successfully',
      data: {
        verification: {
          member_id: member.member_id,
        },
        user: await toUserResponse(updatedUser),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const updateCurrentUserProfilePhoto = asyncHandler(async (req, res) => {
  if (req.user.verificationStatus !== 'verified') {
    throw new ApiError(403, 'Your account must be verified before you can change the profile photo');
  }

  if (!req.file) {
    throw new ApiError(400, 'Profile photo file is required');
  }

  const uploadedPhoto = await uploadFileToSupabase({
    bucket: env.supabaseProfilePhotosBucket,
    folder: `users/${req.user.userId}`,
    file: req.file,
  });
  const newPhotoPath = uploadedPhoto.storageReference;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentUserResult = await client.query(
      `
        SELECT user_id, email, profile_photo_path
        FROM users
        WHERE user_id = $1
      `,
      [req.user.userId]
    );

    const existingUser = currentUserResult.rows[0];

    if (!existingUser) {
      throw new ApiError(404, 'User not found');
    }

    const updatedUserResult = await client.query(
      `
        UPDATE users
        SET
          profile_photo_path = $1,
          profile_photo_updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
        RETURNING
          user_id,
          first_name,
          middle_name,
          last_name,
          father_name,
          mother_name,
          date_of_birth,
          email,
          phone,
          national_id_number,
          gender,
          governorate,
          profile_photo_path,
          profile_photo_updated_at,
          role,
          verification_status,
          email_verified_at,
          verification_review_notes,
          verification_submitted_at,
          verification_reviewed_at,
          applicant_id,
          created_at
      `,
      [newPhotoPath, req.user.userId]
    );

    const updatedUser = updatedUserResult.rows[0];

    await createAuditLog({
      userId: req.user.userId,
      action: 'UPDATE_PROFILE_PHOTO',
      entityType: 'users',
      entityId: updatedUser.user_id,
      details: {
        email: updatedUser.email,
      },
      client,
    });

    await client.query('COMMIT');

    if (existingUser.profile_photo_path && existingUser.profile_photo_path !== newPhotoPath) {
      await deleteSupabaseFile(existingUser.profile_photo_path);
    }

    res.status(200).json({
      message: 'Profile photo updated successfully',
      data: await toUserResponse(updatedUser),
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (newPhotoPath) {
      await deleteSupabaseFile(newPhotoPath);
    }

    throw error;
  } finally {
    client.release();
  }
});

const runAccountVerificationReviewInBackground = ({
  userId,
  accountVerificationId,
  accountVerificationCode,
  email,
  firstName,
}) => {
  setImmediate(async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const accountAiReview = await verificationService.reviewAccount({
        client,
        userId,
        accountVerificationId,
      });

      await createAuditLog({
        userId,
        action: 'AI_REVIEW_ACCOUNT',
        entityType: 'users',
        entityId: userId,
        details: {
          score: accountAiReview?.score,
          status: accountAiReview?.status,
          failures: accountAiReview?.failures || [],
          warnings: accountAiReview?.warnings || [],
        },
        client,
      });

      await client.query('COMMIT');

      try {
        await sendAccountVerificationCompletedEmail({
          email,
          firstName,
          verificationCode: accountVerificationCode,
          status: accountAiReview?.status,
          warnings: [...(accountAiReview?.failures || []), ...(accountAiReview?.warnings || [])],
        });
      } catch (emailError) {
        console.error('Failed to send account verification completion email:', emailError);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Background account verification failed:', error);

      try {
        await sendAccountVerificationFailedEmail({
          email,
          firstName,
          verificationCode: accountVerificationCode,
          failures: [error.message || 'The automatic verification process failed. Staff review is required.'],
        });
      } catch (emailError) {
        console.error('Failed to send account verification failure email:', emailError);
      }
    } finally {
      client.release();
    }
  });
};

export const submitCurrentUserVerificationFiles = asyncHandler(async (req, res) => {
  if (req.user.role !== 'applicant') {
    throw new ApiError(403, 'Only applicant accounts can submit account verification files');
  }

  if (!req.user.emailVerifiedAt) {
    throw new ApiError(403, 'Please verify your email before submitting account verification files');
  }

  if (req.user.verificationStatus === 'verified') {
    throw new ApiError(400, 'This account is already verified');
  }

  const nationalIdFrontFile = getRequiredUploadedFile(req.files, 'national_id_front');
  const nationalIdBackFile = getRequiredUploadedFile(req.files, 'national_id_back');
  const selfiePhotoFile = getRequiredUploadedFile(req.files, 'selfie_photo');
  const verificationFiles = [
    { document_type: 'national_id_front', file: nationalIdFrontFile },
    { document_type: 'national_id_back', file: nationalIdBackFile },
    { document_type: 'selfie_photo', file: selfiePhotoFile },
  ];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureMemberIdSchema(client);

    const verificationResult = await client.query(
      `
        INSERT INTO account_verifications (user_id, status, submitted_at)
        VALUES ($1, 'under_review', CURRENT_TIMESTAMP)
        RETURNING account_verification_id, submitted_at
      `,
      [req.user.userId]
    );

    const accountVerificationId = verificationResult.rows[0].account_verification_id;
    const accountVerificationCode = buildAccountVerificationCode(
      accountVerificationId,
      verificationResult.rows[0].submitted_at
    );

    await client.query(
      `
        UPDATE account_verifications
        SET verification_code = $1
        WHERE account_verification_id = $2
      `,
      [accountVerificationCode, accountVerificationId]
    );

    const uploadedFiles = {};

    for (const verificationFile of verificationFiles) {
      const uploadedFile = await uploadFileToSupabase({
        bucket: env.supabaseAccountVerificationBucket,
        folder: `users/${req.user.userId}`,
        file: verificationFile.file,
      });

      uploadedFiles[verificationFile.document_type] = uploadedFile;

      await client.query(
        `
          INSERT INTO user_verification_files (
            user_id,
            account_verification_id,
            document_type,
            file_name,
            file_path
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          req.user.userId,
          accountVerificationId,
          verificationFile.document_type,
          uploadedFile.fileName,
          uploadedFile.storageReference,
        ]
      );
    }

    await client.query(
      `
        UPDATE users
        SET
          profile_photo_path = $1,
          verification_status = 'under_review',
          verification_review_notes = NULL,
          verification_submitted_at = CURRENT_TIMESTAMP,
          verification_reviewed_at = NULL
        WHERE user_id = $2
      `,
      [uploadedFiles.selfie_photo.storageReference, req.user.userId]
    );

    await createAuditLog({
      userId: req.user.userId,
      action: 'SUBMIT_ACCOUNT_VERIFICATION_FILES',
      entityType: 'users',
      entityId: req.user.userId,
      details: {
        account_verification_id: accountVerificationId,
        verification_code: accountVerificationCode,
      },
      client,
    });

    const submittedUserResult = await client.query(`${userSelectQuery} WHERE user_id = $1`, [req.user.userId]);

    await client.query('COMMIT');

    try {
      await sendAccountVerificationSubmittedEmail({
        email: req.user.email,
        firstName: req.user.firstName,
        verificationCode: accountVerificationCode,
      });
    } catch (emailError) {
      console.error('Failed to send account verification submission email:', emailError);
    }

    runAccountVerificationReviewInBackground({
      userId: req.user.userId,
      accountVerificationId,
      accountVerificationCode,
      email: req.user.email,
      firstName: req.user.firstName,
    });

    res.status(202).json({
      message: 'Account verification files submitted successfully. Verification is running in the background.',
      data: {
        user: await toUserResponse(submittedUserResult.rows[0]),
        account_ai_review: {
          account_verification_id: accountVerificationId,
          verification_code: accountVerificationCode,
          status: 'under_review',
          failures: [],
          warnings: [],
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

const parseJsonField = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value;
};

const accountVerificationSelect = `
  SELECT
    av.account_verification_id,
    av.verification_code,
    av.user_id,
    av.status,
    av.ai_score,
    av.extracted_data,
    av.failures,
    av.warnings,
    av.id_face_image_path,
    av.signature_image_path,
    av.review_notes,
    av.submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Beirut' AS submitted_at,
    av.reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Beirut' AS reviewed_at,
    av.decision_notes,
    av.decided_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Beirut' AS decided_at,
    TRIM(CONCAT_WS(' ', decider.first_name, decider.middle_name, decider.last_name)) AS decided_by_name,
    u.member_id,
    u.first_name,
    u.middle_name,
    u.last_name,
    u.father_name,
    u.mother_name,
    u.date_of_birth,
    u.place_of_birth,
    u.email,
    u.phone,
    u.national_id_number,
    u.gender,
    u.governorate,
    u.blood_type,
    u.marital_status,
    u.registry_number,
    u.verification_status
  FROM account_verifications av
  JOIN users u ON u.user_id = av.user_id
  LEFT JOIN users decider ON decider.user_id = av.decided_by
`;

const toAccountVerificationResponse = async (review, files = []) => ({
  ...review,
  full_name: buildFullName(review),
  extracted_data: parseJsonField(review.extracted_data, {}),
  failures: parseJsonField(review.failures, []),
  warnings: parseJsonField(review.warnings, []),
  id_face_image_url:
    (await createSignedStorageUrl(review.id_face_image_path)) || review.id_face_image_path || '',
  signature_image_url:
    (await createSignedStorageUrl(review.signature_image_path)) || review.signature_image_path || '',
  files: await Promise.all(
    files.map(async (file) => ({
      ...file,
      signed_url: (await createSignedStorageUrl(file.file_path)) || file.file_path,
    }))
  ),
});

export const listAccountVerifications = asyncHandler(async (req, res) => {
  await ensureMemberIdSchema();

  const values = [];
  const conditions = [];
  const status = req.query.status?.trim();
  const memberId = req.query.memberId?.trim();
  const verificationCode = req.query.verificationCode?.trim();

  if (status) {
    values.push(status);
    conditions.push(`av.status = $${values.length}`);
  }

  if (memberId) {
    values.push(memberId);
    conditions.push(`UPPER(u.member_id) = UPPER($${values.length})`);
  }

  if (verificationCode) {
    values.push(verificationCode);
    conditions.push(`UPPER(av.verification_code) = UPPER($${values.length})`);
  }

  const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `${accountVerificationSelect}${whereClause} ORDER BY av.account_verification_id DESC LIMIT 100`,
    values
  );

  res.status(200).json({
    data: await Promise.all(result.rows.map((review) => toAccountVerificationResponse(review))),
  });
});

export const getAccountVerificationById = asyncHandler(async (req, res) => {
  await ensureMemberIdSchema();

  const accountVerificationId = Number(req.params.accountVerificationId);
  const reviewResult = await query(
    `${accountVerificationSelect} WHERE av.account_verification_id = $1`,
    [accountVerificationId]
  );
  const review = reviewResult.rows[0];

  if (!review) {
    throw new ApiError(404, 'Account verification review not found');
  }

  const filesResult = await query(
    `
      SELECT verification_file_id, document_type, file_name, file_path, uploaded_at
      FROM user_verification_files
      WHERE account_verification_id = $1
      ORDER BY verification_file_id
    `,
    [accountVerificationId]
  );

  res.status(200).json({
    data: await toAccountVerificationResponse(review, filesResult.rows),
  });
});

export const decideAccountVerification = asyncHandler(async (req, res) => {
  await ensureMemberIdSchema();

  const accountVerificationId = Number(req.params.accountVerificationId);
  const { decision, notes } = req.body;
  const nextStatus = decision === 'accept' ? 'verified' : 'rejected';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const reviewResult = await client.query(
      `
        SELECT account_verification_id, user_id, status, extracted_data
        FROM account_verifications
        WHERE account_verification_id = $1
      `,
      [accountVerificationId]
    );
    const review = reviewResult.rows[0];

    if (!review) {
      throw new ApiError(404, 'Account verification review not found');
    }

    await client.query(
      `
        UPDATE account_verifications
        SET
          status = $1,
          decision_notes = $2,
          decided_by = $3,
          decided_at = CURRENT_TIMESTAMP,
          reviewed_at = COALESCE(reviewed_at, CURRENT_TIMESTAMP)
        WHERE account_verification_id = $4
      `,
      [nextStatus, notes || null, req.user.userId, accountVerificationId]
    );

    const extractedData = parseJsonField(review.extracted_data, {});
    const updatedUserResult = await client.query(
      `
        UPDATE users
        SET
          verification_status = $1,
          verification_review_notes = $2,
          blood_type = COALESCE($3, blood_type),
          marital_status = COALESCE($4, marital_status),
          registry_number = COALESCE($5, registry_number),
          verification_reviewed_at = CURRENT_TIMESTAMP
        WHERE user_id = $6
        RETURNING
          user_id,
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
          profile_photo_path,
          profile_photo_updated_at,
          role,
          verification_status,
          email_verified_at,
          verification_review_notes,
          verification_submitted_at,
          verification_reviewed_at,
          applicant_id,
          created_at
      `,
      [
        nextStatus,
        notes || null,
        nextStatus === 'verified' ? extractedData.blood_type || null : null,
        nextStatus === 'verified' ? extractedData.marital_status || null : null,
        nextStatus === 'verified' ? extractedData.registry_number || null : null,
        review.user_id,
      ]
    );

    await createAuditLog({
      userId: req.user.userId,
      action: 'DECIDE_ACCOUNT_VERIFICATION',
      entityType: 'account_verifications',
      entityId: accountVerificationId,
      details: {
        user_id: review.user_id,
        previous_status: review.status,
        new_status: nextStatus,
      },
      client,
    });

    await client.query('COMMIT');

    res.status(200).json({
      message: `Account verification ${nextStatus === 'verified' ? 'accepted' : 'rejected'} successfully`,
      data: {
        user: await toUserResponse(updatedUserResult.rows[0]),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const requestCurrentUserPasswordChangeCode = asyncHandler(async (req, res) => {
  const resetCode = generateEightDigitCode();
  const resetCodeHash = hashToken(resetCode);
  const resetExpiresAt = new Date(Date.now() + PASSWORD_CHANGE_TTL_MS);

  const userResult = await query(
    `
      SELECT user_id, first_name, email
      FROM users
      WHERE user_id = $1
    `,
    [req.user.userId]
  );

  const user = userResult.rows[0];

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  await query(
    `
      UPDATE users
      SET
        password_reset_token_hash = $1,
        password_reset_expires_at = $2
      WHERE user_id = $3
    `,
    [resetCodeHash, resetExpiresAt, user.user_id]
  );

  const mailResult = await sendChangePasswordCodeEmail({
    email: user.email,
    firstName: user.first_name,
    changeCode: resetCode,
  });

  try {
    await createAuditLog({
      userId: user.user_id,
      action: 'REQUEST_CHANGE_PASSWORD_CODE',
      entityType: 'users',
      entityId: user.user_id,
      details: { email: user.email },
    });
  } catch (error) {
    console.error('Audit log failed during change-password code request:', error.message);
  }

  res.status(200).json({
    message: 'A password change code has been sent to your email address.',
    data: {
      email_delivery: mailResult.delivered ? 'sent' : 'development_preview',
      dev_change_password_code: mailResult.previewValue,
    },
  });
});

export const changeCurrentUserPassword = asyncHandler(async (req, res) => {
  const { code, new_password } = req.body;
  const codeHash = hashToken(code);
  const passwordHash = await bcrypt.hash(new_password, 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `
        SELECT user_id, email, first_name
        FROM users
        WHERE user_id = $1
          AND password_reset_token_hash = $2
          AND password_reset_expires_at > CURRENT_TIMESTAMP
      `,
      [req.user.userId, codeHash]
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new ApiError(400, 'Password change code is invalid or has expired');
    }

    await client.query(
      `
        UPDATE users
        SET
          password_hash = $1,
          password_reset_token_hash = NULL,
          password_reset_expires_at = NULL
        WHERE user_id = $2
      `,
      [passwordHash, user.user_id]
    );

    await createAuditLog({
      userId: user.user_id,
      action: 'CHANGE_PASSWORD',
      entityType: 'users',
      entityId: user.user_id,
      details: { email: user.email },
      client,
    });

    await client.query('COMMIT');

    await sendPasswordChangedNotificationEmail({
      email: user.email,
      firstName: user.first_name || 'User',
      changeType: 'Password change from account settings',
    });

    res.status(200).json({
      message: 'Password changed successfully.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const updateUserVerificationStatus = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const { verification_status, verification_review_notes } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingUserResult = await client.query(
      `
        SELECT user_id, email, verification_status
        FROM users
        WHERE user_id = $1
      `,
      [userId]
    );

    const existingUser = existingUserResult.rows[0];

    if (!existingUser) {
      throw new ApiError(404, 'User not found');
    }

    const updatedUserResult = await client.query(
      `
        UPDATE users
        SET
          verification_status = $1,
          verification_review_notes = $2,
          verification_reviewed_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
        RETURNING
          user_id,
          first_name,
          middle_name,
          last_name,
          father_name,
          mother_name,
          date_of_birth,
          email,
          phone,
          national_id_number,
          gender,
          governorate,
          profile_photo_path,
          profile_photo_updated_at,
          role,
          verification_status,
          email_verified_at,
          verification_review_notes,
          verification_submitted_at,
          verification_reviewed_at,
          applicant_id,
          created_at
      `,
      [verification_status, verification_review_notes || null, userId]
    );

    const updatedUser = updatedUserResult.rows[0];

    await createAuditLog({
      userId: req.user.userId,
      action: 'UPDATE_USER_VERIFICATION_STATUS',
      entityType: 'users',
      entityId: updatedUser.user_id,
      details: {
        email: updatedUser.email,
        previous_status: existingUser.verification_status,
        new_status: updatedUser.verification_status,
      },
      client,
    });

    await client.query('COMMIT');

    res.status(200).json({
      message: 'User verification status updated successfully',
      data: await toUserResponse(updatedUser),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const runUserAiVerification = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const review = await verificationService.reviewAccount({ client, userId });

    if (!review) {
      throw new ApiError(404, 'User not found');
    }

    await createAuditLog({
      userId: req.user.userId,
      action: 'AI_REVIEW_ACCOUNT',
      entityType: 'users',
      entityId: userId,
      details: {
        score: review.score,
        status: review.status,
        failures: review.failures,
        warnings: review.warnings,
      },
      client,
    });

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Account AI verification completed successfully',
      data: {
        user: await toUserResponse(review.user),
        ai_review: {
          score: review.score,
          status: review.status,
          failures: review.failures,
          warnings: review.warnings,
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

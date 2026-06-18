import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import pool, { query } from '../db/pool.js';
import {
  sendPasswordChangedNotificationEmail,
  sendPasswordResetCodeEmail,
  sendVerificationEmail,
} from '../services/emailService.js';
import { createAuditLog } from '../services/auditLogService.js';
import {
  createSignedStorageUrl,
} from '../services/supabaseStorageService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateEightDigitCode, generateSixDigitCode, hashToken } from '../utils/tokenUtils.js';

const EMAIL_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;

const buildFullName = (user) =>
  [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ');

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

const buildAuthPayload = async (user) => {
  const token = jwt.sign(
    {
      userId: user.user_id,
      role: user.role,
      applicantId: user.applicant_id,
      verificationStatus: user.verification_status,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  const profilePhotoUrl = await createSignedStorageUrl(user.profile_photo_path);

  return {
    token,
    user: {
      user_id: user.user_id,
      member_id: user.member_id,
      first_name: user.first_name,
      middle_name: user.middle_name,
      last_name: user.last_name,
      father_name: user.father_name,
      mother_name: user.mother_name,
      full_name: buildFullName(user),
      date_of_birth: user.date_of_birth,
      place_of_birth: user.place_of_birth,
      email: user.email,
      phone: user.phone,
      national_id_number: user.national_id_number,
      gender: user.gender,
      governorate: user.governorate,
      blood_type: user.blood_type,
      marital_status: user.marital_status,
      registry_number: user.registry_number,
      profile_photo_path: profilePhotoUrl || user.profile_photo_path,
      role: user.role,
      verification_status: user.verification_status,
      email_verified_at: user.email_verified_at,
      applicant_id: user.applicant_id,
      created_at: user.created_at,
    },
  };
};

const createVerificationCodeData = () => {
  const code = generateSixDigitCode();

  return {
    code,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
  };
};

const createResetCodeData = () => {
  const code = generateEightDigitCode();

  return {
    code,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  };
};

export const login = asyncHandler(async (req, res) => {
  await ensureMemberIdSchema();

  const { email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  const userResult = await query(
    `
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
        role,
        verification_status,
        email_verified_at,
        applicant_id,
        created_at,
        password_hash
      FROM users
      WHERE email = $1
    `,
    [normalizedEmail]
  );

  const user = userResult.rows[0];

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.email_verified_at) {
    throw new ApiError(403, 'Please verify your email address before logging in');
  }

  try {
    await createAuditLog({
      userId: user.user_id,
      action: 'USER_LOGIN',
      entityType: 'users',
      entityId: user.user_id,
      details: { email: user.email, verification_status: user.verification_status },
    });
  } catch (error) {
    console.error('Audit log failed during login:', error.message);
  }

  res.status(200).json({
    message: 'Login successful',
    data: await buildAuthPayload(user),
  });
});

export const registerApplicant = asyncHandler(async (req, res) => {
  await ensureMemberIdSchema();

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

  const normalizedEmail = email.trim().toLowerCase();
  const verificationCodeData = createVerificationCodeData();

  const existingUserResult = await query(
    `
      SELECT user_id
      FROM users
      WHERE email = $1 OR national_id_number = $2
    `,
    [normalizedEmail, national_id_number]
  );

  if (existingUserResult.rows[0]) {
    throw new ApiError(409, 'An account with this email or national ID number already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

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
          profile_photo_path,
          password_hash,
          email_verification_token_hash,
          email_verification_expires_at,
          role,
          verification_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'applicant', 'pending')
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
          role,
          verification_status,
          email_verified_at,
          applicant_id,
          created_at
      `,
      [
        first_name.trim(),
        middle_name?.trim() || null,
        last_name.trim(),
        father_name.trim(),
        mother_name.trim(),
        date_of_birth,
        place_of_birth.trim(),
        normalizedEmail,
        phone?.trim() || null,
        national_id_number.trim(),
        gender,
        governorate.trim(),
        blood_type,
        marital_status,
        registry_number.trim(),
        null,
        passwordHash,
        verificationCodeData.codeHash,
        verificationCodeData.expiresAt,
      ]
    );

    const createdUser = createdUserResult.rows[0];
    const memberId = buildMemberId(createdUser.user_id);
    const memberIdResult = await client.query(
      `
        UPDATE users
        SET member_id = $1
        WHERE user_id = $2
        RETURNING *
      `,
      [memberId, createdUser.user_id]
    );
    const createdMemberUser = memberIdResult.rows[0];

    await createAuditLog({
      userId: createdMemberUser.user_id,
      action: 'REGISTER_APPLICANT_ACCOUNT',
      entityType: 'users',
      entityId: createdMemberUser.user_id,
      details: {
        email: createdMemberUser.email,
        member_id: createdMemberUser.member_id,
        verification_status: createdMemberUser.verification_status,
      },
      client,
    });

    await client.query('COMMIT');

    const mailResult = await sendVerificationEmail({
      email: createdUser.email,
      firstName: createdUser.first_name,
      verificationCode: verificationCodeData.code,
    });

    res.status(201).json({
      message: 'Account created successfully. Please verify your email before logging in.',
      data: {
        user: (await buildAuthPayload(createdMemberUser)).user,
        email_delivery: mailResult.delivered ? 'sent' : 'development_preview',
        dev_verification_code: mailResult.previewValue,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await ensureMemberIdSchema();

  const { email, code } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  const codeHash = hashToken(code);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `
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
          role,
          verification_status,
        email_verified_at,
        applicant_id,
        created_at
      FROM users
      WHERE email = $1
        AND email_verification_token_hash = $2
        AND email_verification_expires_at > CURRENT_TIMESTAMP
      `,
      [normalizedEmail, codeHash]
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new ApiError(400, 'Verification code is invalid or has expired');
    }

    const updatedUserResult = await client.query(
      `
      UPDATE users
      SET
        email_verified_at = CURRENT_TIMESTAMP,
          email_verification_token_hash = NULL,
          email_verification_expires_at = NULL
        WHERE user_id = $1
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
          role,
          verification_status,
          email_verified_at,
          applicant_id,
          created_at
      `,
      [user.user_id]
    );

    const updatedUser = updatedUserResult.rows[0];

    await createAuditLog({
      userId: updatedUser.user_id,
      action: 'VERIFY_EMAIL',
      entityType: 'users',
      entityId: updatedUser.user_id,
      details: { email: updatedUser.email },
      client,
    });

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Email verified successfully. You can now log in.',
      data: {
        user: (await buildAuthPayload(updatedUser)).user,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  const userResult = await query(
    `
      SELECT user_id, first_name, email, email_verified_at
      FROM users
      WHERE email = $1
    `,
    [normalizedEmail]
  );

  const user = userResult.rows[0];

  if (!user) {
    throw new ApiError(404, 'No unverified account was found for this email address');
  }

  if (user.email_verified_at) {
    throw new ApiError(400, 'This email address is already verified');
  }

  const verificationCodeData = createVerificationCodeData();

  await query(
    `
      UPDATE users
      SET
        email_verification_token_hash = $1,
        email_verification_expires_at = $2
      WHERE user_id = $3
    `,
    [verificationCodeData.codeHash, verificationCodeData.expiresAt, user.user_id]
  );

  const mailResult = await sendVerificationEmail({
    email: user.email,
    firstName: user.first_name,
    verificationCode: verificationCodeData.code,
  });

  res.status(200).json({
    message: 'Verification email sent successfully',
    data: {
      email_delivery: mailResult.delivered ? 'sent' : 'development_preview',
      dev_verification_code: mailResult.previewValue,
    },
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  const userResult = await query(
    `
      SELECT user_id, first_name, email
      FROM users
      WHERE email = $1
    `,
    [normalizedEmail]
  );

  const user = userResult.rows[0];

  if (!user) {
    throw new ApiError(
      404,
      "We couldn't find an account for that email address. Please check it carefully or create a new account first."
    );
  }

  const resetCodeData = createResetCodeData();

  await query(
    `
      UPDATE users
      SET
        password_reset_token_hash = $1,
        password_reset_expires_at = $2
      WHERE user_id = $3
    `,
    [resetCodeData.codeHash, resetCodeData.expiresAt, user.user_id]
  );

  const mailResult = await sendPasswordResetCodeEmail({
    email: user.email,
    firstName: user.first_name,
    resetCode: resetCodeData.code,
  });

  res.status(200).json({
    message: 'A password reset code has been sent to your email address.',
    data: {
      email_delivery: mailResult.delivered ? 'sent' : 'development_preview',
      dev_reset_code: mailResult.previewValue,
    },
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  const codeHash = hashToken(code);
  const passwordHash = await bcrypt.hash(password, 10);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `
        SELECT user_id, email, first_name
        FROM users
        WHERE email = $1
          AND password_reset_token_hash = $2
          AND password_reset_expires_at > CURRENT_TIMESTAMP
      `,
      [normalizedEmail, codeHash]
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new ApiError(400, 'Password reset code is invalid or has expired');
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
      action: 'RESET_PASSWORD',
      entityType: 'users',
      entityId: user.user_id,
      details: { email: user.email },
      client,
    });

    await client.query('COMMIT');

    await sendPasswordChangedNotificationEmail({
      email: user.email,
      firstName: user.first_name || 'User',
      changeType: 'Password reset via verification code',
    });

    res.status(200).json({
      message: 'Password reset successfully. You can now log in.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

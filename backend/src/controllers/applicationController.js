import pool, { query } from '../db/pool.js';
import { env } from '../config/env.js';
import { createAuditLog } from '../services/auditLogService.js';
import { applicationVerificationService } from '../services/applicationVerificationService.js';
import {
  sendApplicationCancelledEmail,
  sendPassportApplicationDecisionEmail,
  sendPassportApplicationSubmittedEmail,
} from '../services/emailService.js';
import { createSignedStorageUrl, uploadFileToSupabase } from '../services/supabaseStorageService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const aiManagedStatuses = ['pending_ai_review', 'ai_verified', 'ai_rejected'];
const staffCancellableStatuses = ['pending_ai_review', 'ai_verified', 'ai_rejected'];
const requiredApplicationDocumentTypes = {
  first_time: ['photo_id'],
  renewal: ['photo_id', 'old_passport_copy'],
  renewal_lost: ['photo_id'],
};
let applicationSchemaEnsured = false;

const ensurePassportApplicationSchema = async (db = { query }) => {
  if (applicationSchemaEnsured) {
    return;
  }

  await db.query(`
    ALTER TABLE passport_applications
      ADD COLUMN IF NOT EXISTS passport_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS can_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS registry_place VARCHAR(150),
      ADD COLUMN IF NOT EXISTS registry_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS profession VARCHAR(150),
      ADD COLUMN IF NOT EXISTS issuance_date DATE,
      ADD COLUMN IF NOT EXISTS expiry_date DATE,
      ADD COLUMN IF NOT EXISTS ai_score INTEGER,
      ADD COLUMN IF NOT EXISTS ai_extracted_data JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS ai_failures JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS ai_warnings JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS passport_photo_image_path TEXT,
      ADD COLUMN IF NOT EXISTS passport_signature_image_path TEXT,
      ADD COLUMN IF NOT EXISTS passport_mrz_image_path TEXT,
      ADD COLUMN IF NOT EXISTS national_id_signature_image_path TEXT;
  `);

  await db.query(`
    UPDATE passport_applications
    SET passport_type = CASE
      WHEN passport_type IN ('5_year', '10_year') THEN passport_type
      WHEN passport_type IN ('regular', 'ordinary', 'standard', 'service', 'special') THEN '5_year'
      WHEN passport_type IN ('urgent', 'expedited', 'diplomatic') THEN '10_year'
      ELSE '5_year'
    END
    WHERE passport_type IS NULL
       OR passport_type NOT IN ('5_year', '10_year');
  `);

  await db.query(`
    UPDATE passport_applications
    SET application_type = CASE
      WHEN application_type IN ('first_time', 'renewal', 'renewal_lost') THEN application_type
      WHEN application_type IN ('lost', 'replacement', 'lost_renewal') THEN 'renewal_lost'
      ELSE 'first_time'
    END
    WHERE application_type IS NULL
       OR application_type NOT IN ('first_time', 'renewal', 'renewal_lost');
  `);

  await db.query(`
    ALTER TABLE passport_applications
      DROP CONSTRAINT IF EXISTS passport_applications_passport_type_check,
      DROP CONSTRAINT IF EXISTS passport_applications_application_type_check,
      ADD CONSTRAINT passport_applications_passport_type_check
        CHECK (passport_type IN ('5_year', '10_year')),
      ADD CONSTRAINT passport_applications_application_type_check
        CHECK (application_type IN ('first_time', 'renewal', 'renewal_lost'));
  `);

  applicationSchemaEnsured = true;
};

const applicationBaseQuery = `
  SELECT
    pa.application_id,
    pa.application_reference,
    pa.applicant_id,
    pa.application_date,
    pa.status,
    pa.application_type,
    pa.passport_type,
    pa.passport_number,
    pa.can_number,
    pa.registry_place,
    pa.registry_number,
    pa.profession,
    pa.issuance_date,
    pa.expiry_date,
    pa.notes,
    pa.reviewed_by,
    pa.reviewed_at,
    pa.ai_score,
    pa.ai_extracted_data,
    pa.ai_failures,
    pa.ai_warnings,
    pa.passport_photo_image_path,
    pa.passport_signature_image_path,
    pa.passport_mrz_image_path,
    pa.national_id_signature_image_path,
    pa.cancelled_by,
    pa.cancelled_at,
    pa.cancellation_reason,
    pa.created_at,
    pa.updated_at,
    a.first_name,
    a.last_name,
    a.father_name,
    a.mother_name,
    a.date_of_birth,
    a.place_of_birth,
    a.gender,
    a.address,
    a.email AS applicant_email,
    a.national_id_number,
    TRIM(CONCAT_WS(' ', reviewer.first_name, reviewer.middle_name, reviewer.last_name)) AS reviewed_by_name,
    TRIM(CONCAT_WS(' ', canceller.first_name, canceller.middle_name, canceller.last_name)) AS cancelled_by_name
  FROM passport_applications pa
  JOIN applicants a ON a.applicant_id = pa.applicant_id
  LEFT JOIN users reviewer ON reviewer.user_id = pa.reviewed_by
  LEFT JOIN users canceller ON canceller.user_id = pa.cancelled_by
`;

const getApplicationRow = async (dbClient, applicationId) => {
  await ensurePassportApplicationSchema(dbClient);

  const result = await dbClient.query(
    `${applicationBaseQuery} WHERE pa.application_id = $1`,
    [applicationId]
  );

  return result.rows[0];
};

const ensureApplicationAccess = (application, user) => {
  if (user.role === 'applicant' && application.applicant_id !== user.applicantId) {
    throw new ApiError(403, 'You can only access your own application records');
  }
};

const buildApplicationReference = (applicationId, applicationDate = new Date()) =>
  `PS-APP-${applicationDate.getFullYear()}-${String(applicationId).padStart(6, '0')}`;

const createApplicationReference = async (client) => {
  const sequenceResult = await client.query(
    `SELECT nextval(pg_get_serial_sequence('passport_applications', 'application_id')) AS application_id`
  );

  const applicationId = Number(sequenceResult.rows[0].application_id);

  return {
    applicationId,
    applicationReference: buildApplicationReference(applicationId),
  };
};

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) {
    return null;
  }

  const birthDate = new Date(dateOfBirth);
  const today = new Date();

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
};

const updateAiManagedStatusInTransaction = async ({
  client,
  applicationId,
  nextStatus,
  notes,
  currentUser,
}) => {
  const currentApplication = await getApplicationRow(client, applicationId);

  if (!currentApplication) {
    throw new ApiError(404, 'Application not found');
  }

  if (!aiManagedStatuses.includes(nextStatus)) {
    throw new ApiError(400, 'Invalid AI-managed application status');
  }

  if (currentApplication.status === 'cancelled_by_staff' || currentApplication.status === 'issued') {
    throw new ApiError(400, `Cannot change application status from ${currentApplication.status}`);
  }

  const updatedApplicationResult = await client.query(
    `
      UPDATE passport_applications
      SET
        status = $1,
        notes = COALESCE($2, notes),
        reviewed_by = $3,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE application_id = $4
      RETURNING *
    `,
    [nextStatus, notes ?? null, currentUser.userId, applicationId]
  );

  const updatedApplication = updatedApplicationResult.rows[0];

  await createAuditLog({
    userId: currentUser.userId,
    action: 'UPDATE_APPLICATION_AI_STATUS',
    entityType: 'passport_applications',
    entityId: updatedApplication.application_id,
    details: {
      application_reference: currentApplication.application_reference,
      previous_status: currentApplication.status,
      new_status: nextStatus,
    },
    client,
  });

  return {
    ...updatedApplication,
    applicant_email: currentApplication.applicant_email,
    first_name: currentApplication.first_name,
    application_reference: currentApplication.application_reference,
  };
};

export const createApplication = asyncHandler(async (req, res) => {
  await ensurePassportApplicationSchema();

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
  const resolvedApplicantId = req.user.role === 'applicant' ? req.user.applicantId : applicant_id;

  if (req.user.role === 'applicant' && req.user.verificationStatus !== 'verified') {
    throw new ApiError(403, 'Your account must be verified before you can create a passport application');
  }

  if (!resolvedApplicantId) {
    throw new ApiError(400, 'An applicant profile must exist before creating an application');
  }

  const applicantResult = await query(
    `
      SELECT applicant_id
           , date_of_birth
           , first_name
           , email
      FROM applicants
      WHERE applicant_id = $1
    `,
    [resolvedApplicantId]
  );

  const applicant = applicantResult.rows[0];

  if (!applicant) {
    throw new ApiError(404, 'Applicant not found');
  }

  const applicantAge = calculateAge(applicant.date_of_birth);
  if (applicantAge !== null && applicantAge < 18 && passport_type !== '5_year') {
    throw new ApiError(400, 'Applicants under 18 can only apply for a 5 year passport');
  }

  const activeApplicationResult = await query(
    `
      SELECT application_reference, status
      FROM passport_applications
      WHERE applicant_id = $1
        AND status IN ('pending_ai_review', 'ai_verified')
      ORDER BY application_date DESC
      LIMIT 1
    `,
    [resolvedApplicantId]
  );

  if (activeApplicationResult.rows[0]) {
    throw new ApiError(
      400,
      `You already have an active passport application (${activeApplicationResult.rows[0].application_reference}).`
    );
  }

  const applicationLimitResult = await query(
    `
      SELECT
        COUNT(*) FILTER (WHERE application_date >= CURRENT_TIMESTAMP - INTERVAL '1 day') AS submitted_today,
        MAX(application_date) AS last_submission_at
      FROM passport_applications
      WHERE applicant_id = $1
    `,
    [resolvedApplicantId]
  );
  const applicationLimit = applicationLimitResult.rows[0];
  const submittedToday = Number(applicationLimit?.submitted_today || 0);

  if (submittedToday >= 2) {
    throw new ApiError(400, 'You can submit at most two passport applications per day.');
  }

  if (applicationLimit?.last_submission_at) {
    const lastSubmissionAt = new Date(applicationLimit.last_submission_at);
    const nextSubmissionAt = new Date(lastSubmissionAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (nextSubmissionAt > new Date()) {
      throw new ApiError(
        400,
        `You can submit another passport application after ${nextSubmissionAt.toISOString().slice(0, 10)}.`
      );
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { applicationId, applicationReference } = await createApplicationReference(client);

    const createdApplicationResult = await client.query(
      `
        INSERT INTO passport_applications (
          application_id,
          applicant_id,
          application_reference,
          application_type,
          passport_type,
          passport_number,
          can_number,
          registry_place,
          registry_number,
          profession,
          issuance_date,
          expiry_date,
          notes,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending_ai_review')
        RETURNING *
      `,
      [
        applicationId,
        resolvedApplicantId,
        applicationReference,
        application_type,
        passport_type,
        passport_number || null,
        can_number?.trim() || null,
        registry_place?.trim() || null,
        registry_number.trim(),
        profession?.trim() || null,
        issuance_date || null,
        expiry_date || null,
        notes || null,
      ]
    );

    const createdApplication = createdApplicationResult.rows[0];

    await createAuditLog({
      userId: req.user.userId,
      action: 'CREATE_APPLICATION',
      entityType: 'passport_applications',
      entityId: createdApplication.application_id,
      details: {
        applicant_id: resolvedApplicantId,
        application_reference: createdApplication.application_reference,
        application_type,
        passport_type,
        passport_number: passport_number || null,
        can_number,
      },
      client,
    });

    await client.query('COMMIT');

    try {
      await sendPassportApplicationSubmittedEmail({
        email: applicant.email,
        firstName: applicant.first_name,
        applicationReference: createdApplication.application_reference,
      });
    } catch (emailError) {
      console.error('Failed to send passport application submission email:', emailError.message);
    }

    res.status(201).json({
      message: 'Passport application created successfully',
      data: createdApplication,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const listApplications = asyncHandler(async (req, res) => {
  await ensurePassportApplicationSchema();

  const conditions = [];
  const values = [];
  const search = req.query.search?.trim();
  const status = req.query.status?.trim();

  if (req.user.role === 'applicant') {
    if (!req.user.applicantId) {
      return res.status(200).json({ data: [] });
    }

    values.push(req.user.applicantId);
    conditions.push(`pa.applicant_id = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    const placeholder = `$${values.length}`;
    conditions.push(`
      (
        pa.application_reference ILIKE ${placeholder}
        OR a.first_name ILIKE ${placeholder}
        OR a.last_name ILIKE ${placeholder}
        OR a.national_id_number ILIKE ${placeholder}
      )
    `);
  }

  if (status) {
    values.push(status);
    conditions.push(`pa.status = $${values.length}`);
  }

  const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `${applicationBaseQuery}${whereClause} ORDER BY pa.application_id DESC`,
    values
  );

  res.status(200).json({
    data: result.rows,
  });
});

export const getApplicationById = asyncHandler(async (req, res) => {
  await ensurePassportApplicationSchema();

  const applicationId = Number(req.params.id);
  const application = await getApplicationRow({ query }, applicationId);

  if (!application) {
    throw new ApiError(404, 'Application not found');
  }

  ensureApplicationAccess(application, req.user);

  const documentsResult = await query(
    `
      SELECT *
      FROM documents
      WHERE application_id = $1
      ORDER BY document_id DESC
    `,
    [applicationId]
  );

  const passportResult = await query(
    `
      SELECT *
      FROM passport_records
      WHERE application_id = $1
    `,
    [applicationId]
  );

  const accountSignatureResult = await query(
    `
      SELECT av.signature_image_path
      FROM account_verifications av
      JOIN users u ON u.user_id = av.user_id
      WHERE u.applicant_id = $1
      ORDER BY av.account_verification_id DESC
      LIMIT 1
    `,
    [application.applicant_id]
  );
  const nationalIdSignaturePath =
    application.national_id_signature_image_path ||
    accountSignatureResult.rows[0]?.signature_image_path ||
    '';

  const documents = await Promise.all(
    documentsResult.rows.map(async (document) => ({
      ...document,
      signed_url: (await createSignedStorageUrl(document.file_path)) || document.file_path,
    }))
  );

  res.status(200).json({
    data: {
      ...application,
      passport_photo_image_url:
        (await createSignedStorageUrl(application.passport_photo_image_path)) ||
        application.passport_photo_image_path ||
        '',
      passport_signature_image_url:
        (await createSignedStorageUrl(application.passport_signature_image_path)) ||
        application.passport_signature_image_path ||
        '',
      passport_mrz_image_url:
        (await createSignedStorageUrl(application.passport_mrz_image_path)) ||
        application.passport_mrz_image_path ||
        '',
      national_id_signature_image_url:
        (await createSignedStorageUrl(nationalIdSignaturePath)) ||
        nationalIdSignaturePath ||
        '',
      documents,
      passport_record: passportResult.rows[0] || null,
    },
  });
});

export const updateApplicationStatus = asyncHandler(async (req, res) => {
  const applicationId = Number(req.params.id);
  const { status, notes } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updatedApplication = await updateAiManagedStatusInTransaction({
      client,
      applicationId,
      nextStatus: status,
      notes,
      currentUser: req.user,
    });

    await client.query('COMMIT');

    if (status === 'ai_verified' || status === 'ai_rejected') {
      try {
        await sendPassportApplicationDecisionEmail({
          email: updatedApplication.applicant_email,
          firstName: updatedApplication.first_name,
          applicationReference: updatedApplication.application_reference,
          status,
          notes,
        });
      } catch (emailError) {
        console.error('Failed to send passport application decision email:', emailError.message);
      }
    }

    res.status(200).json({
      message: 'Application status updated successfully',
      data: updatedApplication,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const cancelApplication = asyncHandler(async (req, res) => {
  const applicationId = Number(req.params.id);
  const { cancellation_reason } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const application = await getApplicationRow(client, applicationId);

    if (!application) {
      throw new ApiError(404, 'Application not found');
    }

    if (!staffCancellableStatuses.includes(application.status)) {
      throw new ApiError(400, `Cannot cancel an application with status ${application.status}`);
    }

    const updatedApplicationResult = await client.query(
      `
        UPDATE passport_applications
        SET
          status = 'cancelled_by_staff',
          cancelled_by = $1,
          cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE application_id = $3
        RETURNING *
      `,
      [req.user.userId, cancellation_reason || null, applicationId]
    );

    const updatedApplication = updatedApplicationResult.rows[0];

    await createAuditLog({
      userId: req.user.userId,
      action: 'CANCEL_APPLICATION',
      entityType: 'passport_applications',
      entityId: updatedApplication.application_id,
      details: {
        application_reference: application.application_reference,
        previous_status: application.status,
        cancellation_reason: cancellation_reason || null,
      },
      client,
    });

    await client.query('COMMIT');

    await sendApplicationCancelledEmail({
      email: application.applicant_email,
      firstName: application.first_name,
      applicationReference: application.application_reference,
      cancellationReason: cancellation_reason,
    });

    res.status(200).json({
      message: 'Application cancelled successfully',
      data: updatedApplication,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const addDocumentMetadata = asyncHandler(async (req, res) => {
  const applicationId = Number(req.params.id);
  const { document_type, verification_status = 'pending' } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const application = await getApplicationRow(client, applicationId);

    if (!application) {
      throw new ApiError(404, 'Application not found');
    }

    ensureApplicationAccess(application, req.user);

    let fileName = req.body.file_name;
    let filePath = req.body.file_path;

    if (req.file) {
      const uploadedDocument = await uploadFileToSupabase({
        bucket: env.supabaseApplicationDocumentsBucket,
        folder: `applications/${applicationId}`,
        file: req.file,
      });

      fileName = uploadedDocument.fileName;
      filePath = uploadedDocument.storageReference;
    }

    if (!fileName || !filePath) {
      throw new ApiError(400, 'Document file is required');
    }

    const createdDocumentResult = await client.query(
      `
        INSERT INTO documents (
          application_id,
          document_type,
          file_name,
          file_path,
          verification_status
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [applicationId, document_type, fileName, filePath, verification_status]
    );

    const createdDocument = createdDocumentResult.rows[0];

    const availableDocumentsResult = await client.query(
      `
        SELECT DISTINCT document_type
        FROM documents
        WHERE application_id = $1
      `,
      [applicationId]
    );
    const availableDocumentTypes = new Set(
      availableDocumentsResult.rows.map((document) => document.document_type)
    );
    const requiredDocumentTypes = requiredApplicationDocumentTypes[application.application_type] || [];
    const hasRequiredDocuments = requiredDocumentTypes.every((documentType) =>
      availableDocumentTypes.has(documentType)
    );
    const aiReview = hasRequiredDocuments
      ? await applicationVerificationService.reviewApplication({
          client,
          applicationId,
          reviewedByUserId: req.user.userId,
        })
      : null;

    await createAuditLog({
      userId: req.user.userId,
      action: 'ADD_DOCUMENT_METADATA',
      entityType: 'documents',
      entityId: createdDocument.document_id,
      details: {
        application_id: applicationId,
        document_type,
        storage: req.file ? 'supabase' : 'metadata',
      },
      client,
    });

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Document metadata added successfully',
      data: {
        document: createdDocument,
        ai_review: aiReview
          ? {
              status: aiReview.status,
              score: aiReview.score,
              failures: aiReview.failures,
              warnings: aiReview.warnings,
            }
          : null,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const reviewApplicationAi = asyncHandler(async (req, res) => {
  const applicationId = Number(req.params.id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const aiReview = await applicationVerificationService.reviewApplication({
      client,
      applicationId,
      reviewedByUserId: req.user.userId,
    });

    if (!aiReview) {
      throw new ApiError(404, 'Application not found');
    }

    await createAuditLog({
      userId: req.user.userId,
      action: 'REVIEW_APPLICATION_AI',
      entityType: 'passport_applications',
      entityId: applicationId,
      details: {
        status: aiReview.status,
        score: aiReview.score,
        failures: aiReview.failures,
        warnings: aiReview.warnings,
      },
      client,
    });

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Application AI verification completed',
      data: aiReview,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

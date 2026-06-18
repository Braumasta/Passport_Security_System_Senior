import { runPythonAiVerification } from './pythonAiRunner.js';
import {
  downloadSupabaseFileAsBase64,
  uploadBufferToSupabase,
} from './supabaseStorageService.js';
import { env } from '../config/env.js';

export const verificationService = {
  async reviewAccount({ client, userId, accountVerificationId = null }) {
    const userResult = await client.query(
      `
        SELECT
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
          verification_status,
          email_verified_at
        FROM users
        WHERE user_id = $1
      `,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      return null;
    }

    const filesResult = accountVerificationId
      ? await client.query(
          `
            SELECT document_type, file_name, file_path
            FROM user_verification_files
            WHERE user_id = $1
              AND account_verification_id = $2
          `,
          [userId, accountVerificationId]
        )
      : await client.query(
          `
            SELECT document_type, file_name, file_path
            FROM user_verification_files
            WHERE user_id = $1
              AND account_verification_id = (
                SELECT account_verification_id
                FROM account_verifications
                WHERE user_id = $1
                ORDER BY account_verification_id DESC
                LIMIT 1
              )
          `,
          [userId]
        );

    const filesWithContent = await Promise.all(
      filesResult.rows.map(async (file) => ({
        ...file,
        content_base64: await downloadSupabaseFileAsBase64(file.file_path),
      }))
    );

    const analysis = await runPythonAiVerification({
      mode: 'account',
      payload: {
        user,
        files: filesWithContent,
      },
    });

    const reviewNotes = [
      analysis.notes,
      analysis.extracted ? `Extracted data: ${JSON.stringify(analysis.extracted)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const extractedAssets = analysis.extracted_assets || {};
    const uploadedFace = extractedAssets.id_face
      ? await uploadBufferToSupabase({
          bucket: env.supabaseAccountVerificationBucket,
          folder: `reviews/${accountVerificationId || userId}/extracted`,
          buffer: Buffer.from(extractedAssets.id_face, 'base64'),
          fileName: 'id-face.png',
          contentType: 'image/png',
        })
      : null;
    const uploadedSignature = extractedAssets.signature
      ? await uploadBufferToSupabase({
          bucket: env.supabaseAccountVerificationBucket,
          folder: `reviews/${accountVerificationId || userId}/extracted`,
          buffer: Buffer.from(extractedAssets.signature, 'base64'),
          fileName: 'signature.png',
          contentType: 'image/png',
        })
      : null;

    if (analysis.ocr_text) {
      console.log('[Account AI OCR front]', analysis.ocr_text.front || '(empty)');
      console.log('[Account AI OCR back]', analysis.ocr_text.back || '(empty)');
      console.log('[Account AI OCR layout]', analysis.ocr_text.layout || {});
      console.log('[Account AI extracted]', analysis.extracted || {});
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
      [analysis.status, reviewNotes, userId]
    );

    if (accountVerificationId) {
      await client.query(
        `
          UPDATE account_verifications
          SET
            status = $1,
            ai_score = $2,
            extracted_data = $3,
            failures = $4,
            warnings = $5,
            review_notes = $6,
            id_face_image_path = COALESCE($7, id_face_image_path),
            signature_image_path = COALESCE($8, signature_image_path),
            reviewed_at = CURRENT_TIMESTAMP
          WHERE account_verification_id = $9
            AND user_id = $10
        `,
        [
          analysis.status,
          analysis.score,
          JSON.stringify(analysis.extracted || {}),
          JSON.stringify(analysis.failures || []),
          JSON.stringify(analysis.warnings || []),
          reviewNotes,
          uploadedFace?.storageReference || null,
          uploadedSignature?.storageReference || null,
          accountVerificationId,
          userId,
        ]
      );
    }

    return {
      ...analysis,
      accountVerificationId,
      user: updatedUserResult.rows[0],
    };
  },
};

import { env } from '../config/env.js';
import pool from '../db/pool.js';
import { sendAccountDeletionReminderEmail } from './emailService.js';
import { deleteSupabaseFile } from './supabaseStorageService.js';

const ttlMs = () => env.unverifiedAccountTtlMinutes * 60 * 1000;
const reminderLeadMs = () => env.unverifiedAccountReminderLeadMinutes * 60 * 1000;

const deleteUserUploads = async (client, userId) => {
  const filesResult = await client.query(
    `
      SELECT file_path
      FROM user_verification_files
      WHERE user_id = $1
    `,
    [userId]
  );

  const profilePhotoResult = await client.query(
    `
      SELECT profile_photo_path
      FROM users
      WHERE user_id = $1
    `,
    [userId]
  );

  const storagePaths = [
    ...filesResult.rows.map((file) => file.file_path),
    profilePhotoResult.rows[0]?.profile_photo_path,
  ].filter(Boolean);

  await Promise.all(storagePaths.map((storagePath) => deleteSupabaseFile(storagePath)));
};

export const runUnverifiedAccountCleanup = async () => {
  const client = await pool.connect();

  try {
    const now = Date.now();
    const usersResult = await client.query(
      `
        SELECT
          user_id,
          first_name,
          email,
          created_at,
          account_deletion_reminder_sent_at
        FROM users
        WHERE role = 'applicant'
          AND email_verified_at IS NULL
      `
    );

    for (const user of usersResult.rows) {
      const createdAtMs = new Date(user.created_at).getTime();
      const deleteAtMs = createdAtMs + ttlMs();
      const reminderAtMs = deleteAtMs - reminderLeadMs();

      if (now >= deleteAtMs) {
        await client.query('BEGIN');
        await deleteUserUploads(client, user.user_id);
        await client.query('DELETE FROM users WHERE user_id = $1', [user.user_id]);
        await client.query('COMMIT');
        console.log(`[Account cleanup] Deleted unverified account ${user.email}`);
        continue;
      }

      if (!user.account_deletion_reminder_sent_at && now >= reminderAtMs) {
        const minutesUntilDeletion = Math.max(1, Math.ceil((deleteAtMs - now) / 60000));

        await sendAccountDeletionReminderEmail({
          email: user.email,
          firstName: user.first_name,
          minutesUntilDeletion,
        });

        await client.query(
          `
            UPDATE users
            SET account_deletion_reminder_sent_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
          `,
          [user.user_id]
        );

        console.log(`[Account cleanup] Reminder sent to ${user.email}`);
      }
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Account cleanup] Failed:', error.message);
  } finally {
    client.release();
  }
};

export const startUnverifiedAccountCleanupJob = () => {
  setInterval(runUnverifiedAccountCleanup, env.unverifiedAccountCleanupIntervalMs);
  runUnverifiedAccountCleanup().catch((error) => {
    console.error('[Account cleanup] Initial run failed:', error.message);
  });
};

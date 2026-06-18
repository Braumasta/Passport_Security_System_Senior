import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const backendDirectory = path.resolve(currentDirectory, '..', '..');
const projectDirectory = path.resolve(backendDirectory, '..');

dotenv.config({ path: path.join(projectDirectory, '.env') });
dotenv.config({ path: path.join(backendDirectory, '.env'), override: true });

export const env = {
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL || '',
  pgSslMode: process.env.PGSSLMODE || '',
  jwtSecret: process.env.JWT_SECRET || 'development_secret_only',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*',
  appBaseUrl: process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  mailFrom: process.env.MAIL_FROM || 'no-reply@passport-system.local',
  emailEmblemUrl: process.env.EMAIL_EMBLEM_URL || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  aiPythonCommand: process.env.AI_PYTHON_COMMAND || 'python',
  unverifiedAccountTtlMinutes: Number(process.env.UNVERIFIED_ACCOUNT_TTL_MINUTES) || 10080,
  unverifiedAccountReminderLeadMinutes:
    Number(process.env.UNVERIFIED_ACCOUNT_REMINDER_LEAD_MINUTES) || 1440,
  unverifiedAccountCleanupIntervalMs:
    Number(process.env.UNVERIFIED_ACCOUNT_CLEANUP_INTERVAL_MS) || 60 * 60 * 1000,
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseAccountVerificationBucket:
    process.env.SUPABASE_ACCOUNT_VERIFICATION_BUCKET || 'account-verification',
  supabaseProfilePhotosBucket: process.env.SUPABASE_PROFILE_PHOTOS_BUCKET || 'profile-photos',
  supabaseApplicationDocumentsBucket:
    process.env.SUPABASE_APPLICATION_DOCUMENTS_BUCKET || 'application-documents',
};

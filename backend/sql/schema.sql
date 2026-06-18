CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS applicants (
  applicant_id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  father_name VARCHAR(100) NOT NULL,
  mother_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  place_of_birth VARCHAR(150) NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  nationality VARCHAR(100) NOT NULL,
  national_id_number VARCHAR(50) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

  CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    member_id VARCHAR(30) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    mother_name VARCHAR(100),
    date_of_birth DATE,
    place_of_birth VARCHAR(150),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(30),
    national_id_number VARCHAR(50) UNIQUE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
    governorate VARCHAR(100),
    blood_type VARCHAR(5),
    marital_status VARCHAR(30),
    registry_number VARCHAR(50),
    profile_photo_path TEXT,
    profile_photo_updated_at TIMESTAMP,
    password_hash VARCHAR(255) NOT NULL,
    email_verified_at TIMESTAMP,
    email_verification_token_hash TEXT,
    email_verification_expires_at TIMESTAMP,
    password_reset_token_hash TEXT,
    password_reset_expires_at TIMESTAMP,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'officer', 'applicant')),
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'under_review', 'verified', 'rejected')),
  verification_review_notes TEXT,
  verification_submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verification_reviewed_at TIMESTAMP,
  account_deletion_reminder_sent_at TIMESTAMP,
  applicant_id INTEGER UNIQUE REFERENCES applicants(applicant_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_verification_files (
  verification_file_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL
    CHECK (document_type IN ('national_id_front', 'national_id_back', 'selfie_photo')),
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_verifications (
  account_verification_id SERIAL PRIMARY KEY,
  verification_code VARCHAR(30) UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'under_review'
    CHECK (status IN ('pending', 'under_review', 'verified', 'rejected')),
  ai_score INTEGER,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  id_face_image_path TEXT,
  signature_image_path TEXT,
  review_notes TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  decided_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  decision_notes TEXT,
  decided_at TIMESTAMP
);

ALTER TABLE user_verification_files
  ADD COLUMN IF NOT EXISTS account_verification_id INTEGER
    REFERENCES account_verifications(account_verification_id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS passport_applications (
  application_id SERIAL PRIMARY KEY,
  applicant_id INTEGER NOT NULL REFERENCES applicants(applicant_id) ON DELETE CASCADE,
  application_reference VARCHAR(30) NOT NULL UNIQUE,
  application_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_ai_review'
    CHECK (status IN ('pending_ai_review', 'ai_verified', 'ai_rejected', 'cancelled_by_staff', 'issued')),
  application_type VARCHAR(30) NOT NULL DEFAULT 'first_time'
    CHECK (application_type IN ('first_time', 'renewal', 'renewal_lost')),
  passport_type VARCHAR(30) NOT NULL
    CHECK (passport_type IN ('5_year', '10_year')),
  passport_number VARCHAR(30),
  can_number VARCHAR(50),
  registry_place VARCHAR(150),
  registry_number VARCHAR(50),
  profession VARCHAR(150),
  issuance_date DATE,
  expiry_date DATE,
  notes TEXT,
  reviewed_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  cancelled_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  document_id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES passport_applications(application_id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);

CREATE TABLE IF NOT EXISTS passport_records (
  passport_id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL UNIQUE REFERENCES passport_applications(application_id) ON DELETE CASCADE,
  passport_number VARCHAR(30) NOT NULL UNIQUE,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  issuing_authority VARCHAR(150) NOT NULL,
  passport_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (passport_status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  log_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_member_id_unique
  ON users(member_id)
  WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_passport_applications_applicant_id ON passport_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_passport_applications_status ON passport_applications(status);
CREATE INDEX IF NOT EXISTS idx_passport_applications_reference ON passport_applications(application_reference);
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_passport_records_application_id ON passport_records(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_verification_files_user_id ON user_verification_files(user_id);
CREATE INDEX IF NOT EXISTS idx_account_verifications_user_id ON account_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_account_verifications_status ON account_verifications(status);
CREATE INDEX IF NOT EXISTS idx_account_verifications_code ON account_verifications(verification_code);
CREATE INDEX IF NOT EXISTS idx_user_verification_files_review_id ON user_verification_files(account_verification_id);

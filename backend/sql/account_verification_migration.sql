-- Run this once on an existing database that still uses username/full_name in the users table.
-- It updates the users table for the new account verification flow and creates
-- a table to store verification file paths for national ID images and selfies.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS national_id_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS profile_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_updated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMP;

UPDATE users
SET
  first_name = COALESCE(first_name, split_part(full_name, ' ', 1), 'User'),
  last_name = COALESCE(
    last_name,
    NULLIF(trim(regexp_replace(full_name, '^\S+\s*', '')), ''),
    'User'
  )
WHERE first_name IS NULL OR last_name IS NULL;

ALTER TABLE users
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_verification_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_verification_status_check
        CHECK (verification_status IN ('pending', 'under_review', 'verified', 'rejected'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_national_id_number_key'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_national_id_number_key UNIQUE (national_id_number);
  END IF;
END $$;

ALTER TABLE users DROP COLUMN IF EXISTS username;
ALTER TABLE users DROP COLUMN IF EXISTS full_name;

CREATE TABLE IF NOT EXISTS user_verification_files (
  verification_file_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL
    CHECK (document_type IN ('national_id_front', 'national_id_back', 'selfie_photo')),
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status);
CREATE INDEX IF NOT EXISTS idx_user_verification_files_user_id ON user_verification_files(user_id);

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at, CURRENT_TIMESTAMP)
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS account_verifications (
  account_verification_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'under_review'
    CHECK (status IN ('pending', 'under_review', 'verified', 'rejected')),
  ai_score INTEGER,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_notes TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  decided_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  decision_notes TEXT,
  decided_at TIMESTAMP
);

ALTER TABLE user_verification_files
  DROP CONSTRAINT IF EXISTS user_verification_files_user_id_document_type_key;

ALTER TABLE user_verification_files
  ADD COLUMN IF NOT EXISTS account_verification_id INTEGER
    REFERENCES account_verifications(account_verification_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_account_verifications_user_id
  ON account_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_account_verifications_status
  ON account_verifications(status);

CREATE INDEX IF NOT EXISTS idx_user_verification_files_review_id
  ON user_verification_files(account_verification_id);

INSERT INTO account_verifications (
  user_id,
  status,
  review_notes,
  submitted_at,
  reviewed_at
)
SELECT
  u.user_id,
  u.verification_status,
  u.verification_review_notes,
  u.verification_submitted_at,
  u.verification_reviewed_at
FROM users u
WHERE u.role = 'applicant'
  AND EXISTS (
    SELECT 1
    FROM user_verification_files uvf
    WHERE uvf.user_id = u.user_id
      AND uvf.account_verification_id IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM account_verifications av
    WHERE av.user_id = u.user_id
  );

UPDATE user_verification_files uvf
SET account_verification_id = av.account_verification_id
FROM account_verifications av
WHERE uvf.user_id = av.user_id
  AND uvf.account_verification_id IS NULL;

ALTER TABLE account_verifications
  ADD COLUMN IF NOT EXISTS verification_code VARCHAR(30);

UPDATE account_verifications
SET verification_code = CONCAT(
  'AV-',
  EXTRACT(YEAR FROM COALESCE(submitted_at, CURRENT_TIMESTAMP))::INT,
  '-',
  LPAD(account_verification_id::TEXT, 6, '0')
)
WHERE verification_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_verifications_verification_code_unique
  ON account_verifications(verification_code)
  WHERE verification_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_account_verifications_code
  ON account_verifications(verification_code);

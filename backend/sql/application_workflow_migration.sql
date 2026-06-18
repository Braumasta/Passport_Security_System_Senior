ALTER TABLE passport_applications
  ADD COLUMN IF NOT EXISTS application_reference VARCHAR(30),
  ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

UPDATE passport_applications
SET application_reference = CONCAT(
  'LBN-APP-',
  EXTRACT(YEAR FROM COALESCE(application_date, created_at, CURRENT_TIMESTAMP))::TEXT,
  '-',
  LPAD(application_id::TEXT, 6, '0')
)
WHERE application_reference IS NULL;

ALTER TABLE passport_applications
  ALTER COLUMN application_reference SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'passport_applications_application_reference_key'
  ) THEN
    ALTER TABLE passport_applications
      ADD CONSTRAINT passport_applications_application_reference_key UNIQUE (application_reference);
  END IF;
END $$;

ALTER TABLE passport_applications
  DROP CONSTRAINT IF EXISTS passport_applications_status_check;

ALTER TABLE passport_applications
  ADD CONSTRAINT passport_applications_status_check
    CHECK (status IN ('pending_ai_review', 'ai_verified', 'ai_rejected', 'cancelled_by_staff', 'issued'));

UPDATE passport_applications
SET status = CASE status
  WHEN 'pending' THEN 'pending_ai_review'
  WHEN 'under_review' THEN 'pending_ai_review'
  WHEN 'approved' THEN 'ai_verified'
  WHEN 'rejected' THEN 'ai_rejected'
  ELSE status
END
WHERE status IN ('pending', 'under_review', 'approved', 'rejected');

CREATE INDEX IF NOT EXISTS idx_passport_applications_reference
  ON passport_applications(application_reference);

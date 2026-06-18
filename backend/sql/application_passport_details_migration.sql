ALTER TABLE passport_applications
  ADD COLUMN IF NOT EXISTS application_type VARCHAR(30) NOT NULL DEFAULT 'first_time',
  ADD COLUMN IF NOT EXISTS passport_number VARCHAR(30),
  ADD COLUMN IF NOT EXISTS registry_place VARCHAR(150),
  ADD COLUMN IF NOT EXISTS registry_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS profession VARCHAR(150),
  ADD COLUMN IF NOT EXISTS issuance_date DATE,
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

UPDATE passport_applications
SET application_type = CASE
  WHEN application_type IN ('first_time', 'renewal', 'renewal_lost') THEN application_type
  WHEN application_type IN ('lost', 'replacement', 'lost_renewal') THEN 'renewal_lost'
  ELSE 'first_time'
END
WHERE application_type IS NULL
   OR application_type NOT IN ('first_time', 'renewal', 'renewal_lost');

ALTER TABLE passport_applications
  DROP CONSTRAINT IF EXISTS passport_applications_application_type_check;

ALTER TABLE passport_applications
  ADD CONSTRAINT passport_applications_application_type_check
  CHECK (application_type IN ('first_time', 'renewal', 'renewal_lost'));

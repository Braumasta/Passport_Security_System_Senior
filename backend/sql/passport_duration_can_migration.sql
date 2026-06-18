ALTER TABLE passport_applications
  ADD COLUMN IF NOT EXISTS can_number VARCHAR(50);

UPDATE passport_applications
SET passport_type = CASE
  WHEN passport_type IN ('5_year', '10_year') THEN passport_type
  WHEN passport_type IN ('regular', 'ordinary', 'standard', 'service', 'special') THEN '5_year'
  WHEN passport_type IN ('urgent', 'expedited', 'diplomatic') THEN '10_year'
  ELSE '5_year'
END
WHERE passport_type IS NULL
   OR passport_type NOT IN ('5_year', '10_year');

ALTER TABLE passport_applications
  DROP CONSTRAINT IF EXISTS passport_applications_passport_type_check;

ALTER TABLE passport_applications
  ADD CONSTRAINT passport_applications_passport_type_check
  CHECK (passport_type IN ('5_year', '10_year'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS father_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mother_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS governorate VARCHAR(100),
  ADD COLUMN IF NOT EXISTS account_deletion_reminder_sent_at TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_gender_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_gender_check CHECK (gender IN ('male', 'female', 'other'));
  END IF;
END $$;

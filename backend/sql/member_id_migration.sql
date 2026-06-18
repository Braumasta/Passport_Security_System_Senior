ALTER TABLE users
  ADD COLUMN IF NOT EXISTS member_id VARCHAR(30);

UPDATE users
SET member_id = CONCAT('PS-MEM-', LPAD(user_id::TEXT, 6, '0'))
WHERE role = 'applicant'
  AND member_id IS NULL;

UPDATE users
SET member_id = NULL
WHERE role <> 'applicant'
  AND member_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_member_id_unique
  ON users(member_id)
  WHERE member_id IS NOT NULL;

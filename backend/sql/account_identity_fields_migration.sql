ALTER TABLE users
  ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(150),
  ADD COLUMN IF NOT EXISTS blood_type VARCHAR(5),
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS registry_number VARCHAR(50);

ALTER TABLE account_verifications
  ADD COLUMN IF NOT EXISTS id_face_image_path TEXT,
  ADD COLUMN IF NOT EXISTS signature_image_path TEXT;

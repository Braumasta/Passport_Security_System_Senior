-- Run this file after schema.sql.
-- Safe to run more than once. It creates test users, one applicant,
-- one passport application, required document metadata, and audit entries.

INSERT INTO applicants (
  first_name,
  last_name,
  father_name,
  mother_name,
  date_of_birth,
  place_of_birth,
  gender,
  nationality,
  national_id_number,
  phone,
  email,
  address
)
VALUES (
  'Ali',
  'Haddad',
  'Mahmoud',
  'Rana',
  '1999-05-12',
  'Springfield',
  'male',
  'Applicant',
  '1999000001',
  '+1234000001',
  'ali.haddad@example.com',
  '42 Cedar Street, Springfield'
)
ON CONFLICT (national_id_number) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  father_name = EXCLUDED.father_name,
  mother_name = EXCLUDED.mother_name,
  date_of_birth = EXCLUDED.date_of_birth,
  place_of_birth = EXCLUDED.place_of_birth,
  gender = EXCLUDED.gender,
  nationality = EXCLUDED.nationality,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address;

INSERT INTO users (
  first_name,
  middle_name,
  last_name,
  father_name,
  mother_name,
  date_of_birth,
  email,
  phone,
  national_id_number,
  gender,
  governorate,
  password_hash,
  email_verified_at,
  role,
  verification_status,
  verification_review_notes,
  verification_reviewed_at
)
VALUES
  (
    'System',
    null,
    'Admin',
    null,
    null,
    '1988-01-10',
    'admin@example.com',
    '+1234000010',
    null,
    null,
    null,
    crypt('Admin123!', gen_salt('bf')),
    CURRENT_TIMESTAMP,
    'admin',
    'verified',
    'Seeded administrator account.',
    CURRENT_TIMESTAMP
  ),
  (
    'Passport',
    null,
    'Officer',
    null,
    null,
    '1990-04-22',
    'officer@example.com',
    '+1234000011',
    null,
    null,
    null,
    crypt('Officer123!', gen_salt('bf')),
    CURRENT_TIMESTAMP,
    'officer',
    'verified',
    'Seeded officer account.',
    CURRENT_TIMESTAMP
  )
ON CONFLICT (email) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  middle_name = EXCLUDED.middle_name,
  last_name = EXCLUDED.last_name,
  father_name = EXCLUDED.father_name,
  mother_name = EXCLUDED.mother_name,
  date_of_birth = EXCLUDED.date_of_birth,
  phone = EXCLUDED.phone,
  gender = EXCLUDED.gender,
  governorate = EXCLUDED.governorate,
  password_hash = EXCLUDED.password_hash,
  email_verified_at = EXCLUDED.email_verified_at,
  role = EXCLUDED.role,
  verification_status = EXCLUDED.verification_status,
  verification_review_notes = EXCLUDED.verification_review_notes,
  verification_reviewed_at = EXCLUDED.verification_reviewed_at;

INSERT INTO users (
  first_name,
  middle_name,
  last_name,
  father_name,
  mother_name,
  date_of_birth,
  email,
  phone,
  national_id_number,
  gender,
  governorate,
  password_hash,
  email_verified_at,
  role,
  verification_status,
  verification_review_notes,
  verification_reviewed_at,
  applicant_id
)
VALUES (
  'Ali',
  null,
  'Haddad',
  'Mahmoud',
  'Rana',
  '1999-05-12',
  'applicant@example.com',
  '+1234000012',
  '1999000001',
  'male',
  'Springfield',
  crypt('Applicant123!', gen_salt('bf')),
  CURRENT_TIMESTAMP,
  'applicant',
  'verified',
  'Seeded applicant account with required identity documents.',
  CURRENT_TIMESTAMP,
  (SELECT applicant_id FROM applicants WHERE national_id_number = '1999000001')
)
ON CONFLICT (email) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  middle_name = EXCLUDED.middle_name,
  last_name = EXCLUDED.last_name,
  father_name = EXCLUDED.father_name,
  mother_name = EXCLUDED.mother_name,
  date_of_birth = EXCLUDED.date_of_birth,
  phone = EXCLUDED.phone,
  national_id_number = EXCLUDED.national_id_number,
  gender = EXCLUDED.gender,
  governorate = EXCLUDED.governorate,
  password_hash = EXCLUDED.password_hash,
  email_verified_at = EXCLUDED.email_verified_at,
  role = EXCLUDED.role,
  verification_status = EXCLUDED.verification_status,
  verification_review_notes = EXCLUDED.verification_review_notes,
  verification_reviewed_at = EXCLUDED.verification_reviewed_at,
  applicant_id = EXCLUDED.applicant_id;

INSERT INTO user_verification_files (user_id, document_type, file_name, file_path)
VALUES
  (
    (SELECT user_id FROM users WHERE email = 'applicant@example.com'),
    'national_id_front',
    'ali-haddad-national-id-front.jpg',
    'supabase://account-verification/seed/ali-haddad-national-id-front.jpg'
  ),
  (
    (SELECT user_id FROM users WHERE email = 'applicant@example.com'),
    'national_id_back',
    'ali-haddad-national-id-back.jpg',
    'supabase://account-verification/seed/ali-haddad-national-id-back.jpg'
  ),
  (
    (SELECT user_id FROM users WHERE email = 'applicant@example.com'),
    'selfie_photo',
    'ali-haddad-selfie.jpg',
    'supabase://account-verification/seed/ali-haddad-selfie.jpg'
  )
ON CONFLICT (user_id, document_type) DO UPDATE
SET
  file_name = EXCLUDED.file_name,
  file_path = EXCLUDED.file_path,
  uploaded_at = CURRENT_TIMESTAMP;

INSERT INTO passport_applications (
  applicant_id,
  application_reference,
  application_type,
  passport_type,
  passport_number,
  registry_place,
  registry_number,
  profession,
  issuance_date,
  expiry_date,
  notes,
  status
)
VALUES (
  (SELECT applicant_id FROM applicants WHERE national_id_number = '1999000001'),
  'PS-APP-2026-000001',
  'renewal',
  'regular',
  'RL1234567',
  'Springfield Registry',
  'REG-1999-001',
  'Software Developer',
  '2021-06-01',
  '2026-06-01',
  'Seed application with complete required document metadata.',
  'pending_ai_review'
)
ON CONFLICT (application_reference) DO UPDATE
SET
  applicant_id = EXCLUDED.applicant_id,
  application_type = EXCLUDED.application_type,
  passport_type = EXCLUDED.passport_type,
  passport_number = EXCLUDED.passport_number,
  registry_place = EXCLUDED.registry_place,
  registry_number = EXCLUDED.registry_number,
  profession = EXCLUDED.profession,
  issuance_date = EXCLUDED.issuance_date,
  expiry_date = EXCLUDED.expiry_date,
  notes = EXCLUDED.notes,
  status = EXCLUDED.status,
  reviewed_by = null,
  reviewed_at = null,
  cancelled_by = null,
  cancelled_at = null,
  cancellation_reason = null,
  updated_at = CURRENT_TIMESTAMP;

DELETE FROM documents
WHERE application_id = (
  SELECT application_id
  FROM passport_applications
  WHERE application_reference = 'PS-APP-2026-000001'
);

INSERT INTO documents (
  application_id,
  document_type,
  file_name,
  file_path,
  verification_status
)
VALUES
  (
    (SELECT application_id FROM passport_applications WHERE application_reference = 'PS-APP-2026-000001'),
    'passport_application_form',
    'ps-app-2026-000001-application-form.pdf',
    'supabase://application-documents/seed/ps-app-2026-000001-application-form.pdf',
    'pending'
  ),
  (
    (SELECT application_id FROM passport_applications WHERE application_reference = 'PS-APP-2026-000001'),
    'national_id_copy',
    'ps-app-2026-000001-national-id-copy.pdf',
    'supabase://application-documents/seed/ps-app-2026-000001-national-id-copy.pdf',
    'pending'
  ),
  (
    (SELECT application_id FROM passport_applications WHERE application_reference = 'PS-APP-2026-000001'),
    'photo_id',
    'ps-app-2026-000001-photo-id.jpg',
    'supabase://application-documents/seed/ps-app-2026-000001-photo-id.jpg',
    'pending'
  );

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
VALUES
  (
    (SELECT user_id FROM users WHERE email = 'admin@example.com'),
    'SEED_DATA_UPSERT',
    'user',
    (SELECT user_id FROM users WHERE email = 'admin@example.com'),
    jsonb_build_object('email', 'admin@example.com', 'role', 'admin')
  ),
  (
    (SELECT user_id FROM users WHERE email = 'officer@example.com'),
    'SEED_DATA_UPSERT',
    'application',
    (SELECT application_id FROM passport_applications WHERE application_reference = 'PS-APP-2026-000001'),
    jsonb_build_object('reference', 'PS-APP-2026-000001', 'status', 'pending_ai_review')
  );

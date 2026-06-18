# Passport Security Information System - Project Overview

## 1. Purpose

Passport Security is a full-stack information system for online passport services. The application supports applicant registration, email verification, account identity verification, passport application submission, staff review, passport issuance, and admin management. The system is designed as a controlled workflow where an applicant cannot submit a passport application until their account has been verified.

## 2. High-Level Architecture

The project is divided into four main layers:

1. **React frontend** for the user interface.
2. **Express backend** for API routes, authentication, validation, business rules, and database access.
3. **Supabase PostgreSQL and Storage** for persistent data and uploaded files.
4. **Python OCR/AI services** for account document extraction and passport document extraction.

The frontend communicates with the backend through `/api` endpoints. The backend stores relational data in PostgreSQL and stores uploaded images/documents in Supabase Storage. Python scripts are called by the Node backend when account verification or passport OCR review needs to run.

## 3. Frontend Technologies

- **React 18:** Main UI framework.
- **Vite 5:** Development server and production build tool.
- **React Router v6:** Client-side routing.
- **React Bootstrap and Bootstrap 5:** Layout, forms, navigation, cards, tables, modals, and alerts.
- **CSS modules/files:** Page-specific styling for Header, Footer, Account, Operations, Management, Registration, Home, Information pages, and passport application form.

Important frontend files:

- `src/App.jsx`: Defines application routes and access guards.
- `src/components/Header.jsx`: Main navigation, account dropdown, role-based links.
- `src/components/Footer.jsx`: Footer links and layout.
- `src/components/PassportApplicationForm.jsx`: Passport application form and document upload flow.
- `src/pages/AccountPage.jsx`: My Account, profile photo, account verification upload, saved account details, password change.
- `src/pages/OperationsPage.jsx`: Staff review dashboard for account verification and passport applications.
- `src/pages/ManagementPage.jsx`: Admin staff management and member lookup.
- `src/pages/RegisterPage.jsx`: Applicant registration.
- `src/data/lebaneseVillages.js`: Shared place-of-birth dropdown list.

## 4. Backend Technologies

- **Node.js with Express:** API server and route handling.
- **PostgreSQL through `pg`:** Database queries.
- **JWT:** Authentication tokens.
- **bcryptjs:** Password hashing.
- **Multer:** File upload parsing.
- **Nodemailer:** Transactional emails.
- **Supabase JS client:** Storage upload, download, and signed URL generation.
- **dotenv:** Environment configuration.

Important backend files:

- `backend/src/server.js`: Starts the backend and cleanup job.
- `backend/src/app.js`: Express app, CORS, JSON parsing, health route, API routes, error handling.
- `backend/src/config/env.js`: Loads root `.env` and `backend/.env`.
- `backend/src/db/pool.js`: PostgreSQL connection pool.
- `backend/src/routes`: API route definitions and request validation.
- `backend/src/controllers`: Request handlers for auth, users, applicants, applications, and passports.
- `backend/src/services`: Email, Supabase storage, AI runner, verification services, audit logs, cleanup job.
- `backend/sql`: Schema, seed file, and migrations.

## 5. Database and Storage

The database is PostgreSQL hosted on Supabase. Core tables include:

- `users`: Login accounts, roles, account identity data, verification status, profile photo path, member ID.
- `applicants`: Applicant profile records linked to users.
- `account_verifications`: Account verification review records with AV code, AI extracted data, status, warnings, failures, extracted image paths.
- `user_verification_files`: Uploaded national ID front/back and selfie files.
- `passport_applications`: Passport application records, application references, application type, passport details, AI extracted passport data.
- `documents`: Uploaded application documents.
- `passport_records`: Issued passport records.
- `audit_logs`: Staff/admin and system activity trail.

Supabase Storage buckets:

- `account-verification`: National ID, selfie, extracted ID face, extracted ID signature.
- `profile-photos`: User profile photos.
- `application-documents`: Photo ID, old passport, optional replacement documents, extracted passport photo, extracted passport signature.

## 6. Authentication and Roles

The system uses JWT bearer tokens. The backend reads the current user from the database on every authenticated request, so role or verification-status changes take effect without requiring a new token.

Roles:

- **Applicant:** Can register, verify email, upload account verification files, edit allowed account details, and submit passport applications after verification.
- **Officer:** Can access Operations to review account verification and passport applications.
- **Admin:** Can access Operations and Management, create staff accounts, revoke staff access, delete staff accounts, and edit member data in support cases.

## 7. Registration and Email Verification

Applicants register through `/register`. Required data includes identity details, civil record details, contact details, password, national ID number, governorate, blood type, marital status, registry number, and place of birth.

After registration:

1. The backend creates the applicant user.
2. The password is hashed.
3. A verification code is generated.
4. An email is sent through SMTP.
5. The user must verify the email before account verification upload is allowed.

The email verification page does not allow the user to edit the registered email field.

## 8. Unverified Account Cleanup

The backend starts an unverified-account cleanup job when the server starts. Its configuration is controlled by:

- `UNVERIFIED_ACCOUNT_TTL_MINUTES`
- `UNVERIFIED_ACCOUNT_REMINDER_LEAD_MINUTES`
- `UNVERIFIED_ACCOUNT_CLEANUP_INTERVAL_MS`

The intended production behavior is account deletion after one week if the account remains unverified. The system can also send reminder emails before deletion.

## 9. Account Verification Workflow

Account verification happens after registration and email verification.

Applicant uploads:

- National ID front.
- National ID back.
- Selfie photo.

The backend stores the files in Supabase and creates an account verification record with a code like `AV-2026-000001`.

Python account verification script:

- File: `backend/ai/account_verification_ai.py`
- Extracts Arabic ID fields and translates/normalizes them.
- Extracts ID face crop.
- Extracts ID signature crop.
- Compares selfie face to ID face.
- Compares extracted fields against saved user data.
- Returns status, score, warnings, failures, extracted fields, raw OCR text, and extracted image assets.

The account review is not immediately rejected when some fields are missing or slightly mismatched. Missing or suspicious values are placed under staff review. Clean matches can be marked verified.

Operations Account Document Review displays:

- AV code.
- Applicant name.
- Status.
- Submitted date.
- Uploaded national ID front/back/selfie.
- Extracted ID face.
- Extracted ID signature.
- User-provided data vs extracted data table.
- Green check or red X per field.
- Staff accept/reject buttons and notes.

## 10. Passport Application Workflow

Only verified applicants can access the passport application page.

Application types:

- First-time application.
- Renewal application.
- Renewal due to lost passport.

Passport duration:

- 5 year passport.
- 10 year passport.

Applicants under 18 can only choose the 5 year passport option.

For first-time and lost-passport renewal:

- The passport/registry section is shown as **Registry Details**.
- Only `Registry Number` is required in that section.

For standard renewal:

- The section is shown as **Passport and Registry Details**.
- Passport number, CAN, registry place, registry number, profession, issuance date, and expiry date are required.

Required documents:

- Photo ID is required for all application types.
- Old passport is required only for standard renewal.
- Replacement document is optional for lost-passport renewal.
- National ID upload is not required in the passport application because it was already provided during account verification.
- Passport application form upload is not required because the user is filling out the application inside the system.

## 11. Passport Application Python OCR

Passport application OCR is separated from account verification.

File:

- `backend/ai/passport_application_ai.py`

This script:

- Reads uploaded old passport image when present.
- Crops fixed passport regions based on the marked passport layout.
- Extracts passport fields using Tesseract OCR.
- Keeps extracted passport photo and passport signature crops.
- Compares the submitted photo ID face against the verified national ID face.
- Compares passport signature against verified national ID signature.
- Compares OCR extracted passport data against form data and saved account data.
- Returns extracted values, warnings, failures, score, and extracted assets.

Extracted passport fields include:

- Mother name.
- Registry place and number.
- Profession.
- Passport photo.
- Signature.
- Last name.
- Passport number.
- CAN.
- First name.
- Father name.
- Nationality.
- Place of birth.
- Issuance date.
- Expiry date.
- Date of birth.
- Gender.
- MRZ text.

## 12. Operations Dashboard

Operations is available to admin and officer accounts. It has two separated work areas:

1. Account Verification.
2. Passport Application Review.

Account Verification supports:

- Status filter.
- AV code search.
- Queue table.
- Detail panel.
- Image modal preview.
- Field comparison table.
- Staff accept/reject decisions.

Passport Application Review supports:

- Application reference search with `PS-APP-` prefix.
- Status filter.
- Queue table.
- Detail panel.
- Uploaded document preview.
- OCR comparison table.
- Extracted passport photo/signature previews.
- AI verification action.
- Cancellation action.
- Passport issuance fields at the end of the detail panel.

## 13. Management Dashboard

Management is admin-only.

Features:

- Create staff accounts.
- View staff account list.
- Revoke staff access.
- Delete staff accounts.
- Look up applicants by `PS-MEM-` member ID.
- Edit member support fields when a user made a registration mistake.
- Delete member accounts when necessary.

Normal members cannot edit protected fields such as national ID number, registry number, or blood type from My Account. Admin can update those fields through member lookup.

## 14. Email System

Nodemailer sends:

- Email verification codes.
- Resend verification emails.
- Password reset emails.
- Password changed notification.
- Account verification submitted email.
- Account verification completed or review-required emails.
- Account verification failed/retry emails.
- Application cancellation emails.

Email branding uses `EMAIL_EMBLEM_URL`.

## 15. Assets

Static branding assets are hosted externally through GitHub Pages:

- Passport Security logo.
- Email transparent logo.
- Favicon PNG.

This keeps the app repository lighter and lets email logo URLs use public HTTPS paths.

## 16. Important Environment Variables

Database:

- `DATABASE_URL`
- `PGSSLMODE`

Backend/security:

- `PORT`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `APP_BASE_URL`

Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCOUNT_VERIFICATION_BUCKET`
- `SUPABASE_PROFILE_PHOTOS_BUCKET`
- `SUPABASE_APPLICATION_DOCUMENTS_BUCKET`

Email:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `EMAIL_EMBLEM_URL`

AI/OCR:

- `AI_PYTHON_COMMAND`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_ACCOUNT_OCR_MODEL`
- `GEMINI_ACCOUNT_VERIFICATION_MODEL`

Cleanup:

- `UNVERIFIED_ACCOUNT_TTL_MINUTES`
- `UNVERIFIED_ACCOUNT_REMINDER_LEAD_MINUTES`
- `UNVERIFIED_ACCOUNT_CLEANUP_INTERVAL_MS`

## 17. Running the Project

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

Python OCR:

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ai\requirements.txt
```

Tesseract OCR must be installed separately and available on PATH.

## 18. Verification and Review Philosophy

The system uses AI/OCR as a decision-support tool. It extracts fields, highlights mismatches, and calculates comparison indicators. Staff still have final control in review cases. The system avoids automatic rejection when OCR data is incomplete or uncertain; it sends questionable records to staff review.

## 19. Current Limitations

- OCR accuracy depends on image quality, lighting, rotation, and document crop.
- Tesseract must be installed correctly on the hosting machine.
- Face and signature matching use local computer-vision heuristics, not a dedicated biometric-grade model.
- Gemini can improve account ID extraction when configured, but local OCR remains important.
- Passport OCR regions are based on the current passport layout and may need adjustment for different document layouts.

## 20. Project Outcome

The project demonstrates a complete passport-service workflow with frontend forms, backend APIs, database persistence, file uploads, staff review, admin management, email notifications, and AI-assisted document verification.

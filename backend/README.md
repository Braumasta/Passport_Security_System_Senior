# Passport System Backend

Simple Node.js + Express + PostgreSQL backend for a university passport generation and verification project.

This backend is intentionally kept simple:
- plain Express routes and controllers
- plain SQL with the `pg` package
- Supabase PostgreSQL through `DATABASE_URL`
- Supabase Storage for uploaded images and documents
- JWT login with hashed passwords
- email verification and password reset by email
- clear PostgreSQL schema in one SQL file
- beginner-friendly folder structure
- Python-based verification service

## Project Structure

```text
backend/
├── postman/
│   └── passport-system.postman_collection.json
├── sql/
│   ├── schema.sql
│   ├── account_verification_migration.sql
│   ├── email_auth_migration.sql
│   └── seed.sql
├── src/
│   ├── config/
│   │   └── env.js
│   ├── controllers/
│   │   ├── applicantController.js
│   │   ├── applicationController.js
│   │   ├── authController.js
│   │   ├── passportController.js
│   │   └── userController.js
│   ├── db/
│   │   └── pool.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── errorHandler.js
│   │   ├── notFound.js
│   │   ├── uploadMiddleware.js
│   │   └── validateRequest.js
│   ├── routes/
│   │   ├── applicantRoutes.js
│   │   ├── applicationRoutes.js
│   │   ├── authRoutes.js
│   │   ├── index.js
│   │   ├── passportRoutes.js
│   │   └── userRoutes.js
│   ├── services/
│   │   ├── auditLogService.js
│   │   └── verificationService.js
│   ├── utils/
│   │   ├── ApiError.js
│   │   ├── asyncHandler.js
│   │   └── validation.js
│   ├── app.js
│   └── server.js
├── .env
├── .gitignore
└── package.json
```

## Plain-Language Structure Explanation

- `src/config`: Reads environment variables like database credentials and JWT secret.
- `src/db`: Creates the PostgreSQL connection pool.
- `src/controllers`: Contains the main request logic for each module.
- `src/routes`: Defines the REST API endpoints and connects them to controllers.
- `src/middleware`: Handles auth, role checks, validation, not-found responses, and centralized errors.
- `src/middleware/uploadMiddleware.js`: Validates multipart files before they are uploaded to Supabase Storage.
- `src/services`: Contains reusable business helpers for audit logging, Supabase Storage, email, and AI verification.
- `src/utils`: Small helpers for async error handling, custom API errors, and validation.
- `sql/schema.sql`: Creates the database tables, keys, constraints, and indexes.
- `sql/account_verification_migration.sql`: Updates an existing database to the new verified-account structure.
- `sql/email_auth_migration.sql`: Adds phone number and email-auth columns to an existing database.
- `sql/seed.sql`: Adds sample records so you can test the system quickly.
- `postman/`: Ready-to-import requests for Postman.

## Database Tables and Relationships

### Tables

1. `applicants`
Stores personal applicant data.

2. `users`
Stores system users for login and account verification.
Roles: `admin`, `officer`, `applicant`

Main fields:
- `first_name`
- `middle_name`
- `last_name`
- `date_of_birth`
- `email`
- `phone`
- `national_id_number`
- `verification_status`
- `email_verified_at`
- `created_at`

3. `user_verification_files`
Stores the uploaded verification files for each user account.

4. `passport_applications`
Stores passport requests linked to applicants.

5. `documents`
Stores uploaded document metadata for each application.

6. `passport_records`
Stores issued passport information.

7. `audit_logs`
Stores important actions for traceability.

### Relationships

- One `applicant` can have many `passport_applications`
- One `passport_application` can have many `documents`
- One `passport_application` can have one `passport_record`
- One `user` can review many `passport_applications`
- One `user` can create many `audit_logs`
- One `user` can have many `user_verification_files`
- One `applicant` can optionally be linked to one `user` account with role `applicant`

## API Endpoints

### Auth

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Users

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id/verification`

### Applicants

- `GET /api/applicants`
- `GET /api/applicants/:id`
- `POST /api/applicants`

### Applications

- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/:id`
- `PATCH /api/applications/:id/status`
- `POST /api/applications/:id/documents`
- `POST /api/applications/:id/approve`
- `POST /api/applications/:id/reject`

### Passports

- `GET /api/passports`
- `POST /api/passports`
- `GET /api/passports/:id`

### Utility

- `GET /api/health`

## Setup Instructions

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Connect Supabase PostgreSQL

Add the Supabase connection string to `.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_DATABASE_PASSWORD@db.gjepaywonxuclvakflao.supabase.co:5432/postgres
```

Use the database password created in Supabase. Do not use your Supabase account password.

### 3. Run the schema in Supabase

Open Supabase SQL Editor, copy the contents of `sql/schema.sql`, paste it into the editor, and run it.

If you need one of the migration files, copy its SQL into Supabase SQL Editor and run it there.

### 4. Optional: insert sample seed data

Copy the contents of `sql/seed.sql` into Supabase SQL Editor and run it.

Seeded login accounts:
- `admin@example.com` / `Admin123!`
- `officer@example.com` / `Officer123!`
- `applicant@example.com` / `Applicant123!`

### 5. Fill the environment file

Edit `.env` and set:
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `APP_BASE_URL`
- `MAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `AI_PYTHON_COMMAND`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCOUNT_VERIFICATION_BUCKET`
- `SUPABASE_PROFILE_PHOTOS_BUCKET`
- `SUPABASE_APPLICATION_DOCUMENTS_BUCKET`

Set `CORS_ORIGIN=http://localhost:5173` if your Vite frontend runs on the default port.

### 6. Start the backend

```bash
npm run dev
```

The backend should run at:

```text
http://localhost:5000
```

Health check:

```text
GET http://localhost:5000/api/health
```

## Sample Request Bodies

### Login

```json
{
  "email": "admin@example.com",
  "password": "Admin123!"
}
```

### Register Applicant Account

Use `multipart/form-data`, not JSON.

Fields:
- `first_name`
- `middle_name`
- `last_name`
- `date_of_birth`
- `email`
- `phone`
- `national_id_number`
- `password`
- `national_id_front` (file)
- `national_id_back` (file)
- `selfie_photo` (file)

The account is created with:
- `verification_status = pending`
- `email_verified_at = null`

Flow:
1. register the account
2. open the email verification link
3. log in
4. wait for admin/officer account verification before submitting a passport application

### Create Applicant

```json
{
  "first_name": "Maya",
  "last_name": "Salem",
  "father_name": "Nabil",
  "mother_name": "Lina",
  "date_of_birth": "2000-03-15",
  "place_of_birth": "Springfield",
  "gender": "female",
  "nationality": "Applicant",
  "national_id_number": "2000000011",
  "phone": "+96171111111",
  "email": "maya.salem@example.com",
  "address": "Not provided"
}
```

### Create Application

```json
{
  "applicant_id": 1,
  "passport_type": "regular",
  "notes": "First passport request"
}
```

### Update Application Status

```json
{
  "status": "ai_verified",
  "notes": "Documents passed AI review"
}
```

### Add Application Document

Use `multipart/form-data`, not JSON.

Fields:
- `document_type`
- `verification_status`
- `file`

The backend uploads the file to Supabase Storage and stores a `supabase://bucket/path` reference in PostgreSQL.

### Issue Passport

```json
{
  "application_id": 1,
  "passport_number": "RL0000001",
  "issue_date": "2026-04-11",
  "expiry_date": "2031-04-11",
  "issuing_authority": "Passport Security",
  "passport_status": "active"
}
```

## Postman

Import:

```text
backend/postman/passport-system.postman_collection.json
```

The login request stores the JWT token automatically in the collection variable `token`.

## Notes About Access Control

- `admin` can manage users and all system records
- `officer` can review applications, update status, approve/reject, and issue passports
- `applicant` can only see and work with their own records
- a newly registered `applicant` starts as `pending`
- a `pending` applicant cannot submit a passport application until verified

## Python AI Verification

The backend calls a local Python verifier for account verification at:

```text
backend/ai/account_verification_ai.py
```

The Node service `src/services/verificationService.js` gathers the account data, downloads the national ID front, national ID back, and selfie from Supabase Storage, sends them to Python as JSON/base64, then saves the returned score, extracted fields, warnings, and failures into the existing status and review-note fields.

Configure the Python command in `.env`:

```env
AI_PYTHON_COMMAND=python
```

For stronger Arabic national ID OCR, configure Gemini Vision in `.env`:

```env
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_OCR_MODEL=gemini-1.5-flash
```

When `GEMINI_API_KEY` is set, account verification uses Gemini Vision first to extract raw Arabic fields and translated English values. If Gemini is not configured or the request fails, the verifier falls back to local Tesseract OCR.

On some Windows machines this may need to be:

```env
AI_PYTHON_COMMAND=py -3
```

Current AI review behavior:
- account registration runs Python account verification after files are uploaded
- admins can rerun account AI review with `POST /api/users/:id/ai-verification`
- passport application AI verification is intentionally disabled until account verification is finished

The Python module expects these local dependencies:

```bash
pip install -r backend/ai/requirements.txt
```

You also need the Tesseract OCR engine installed on the machine and available in `PATH` for `pytesseract`.
The national ID OCR is configured for Arabic plus English:

```text
ara+eng
```

Install the Arabic Tesseract language data as well. On Windows, that means `ara.traineddata` must exist in the Tesseract `tessdata` folder. Without Arabic language data, the account AI will not reliably extract names, parent names, gender, governorate, date of birth, or ID number from the national ID.

For testing, unverified applicant accounts are deleted after one minute:

```env
UNVERIFIED_ACCOUNT_TTL_MINUTES=1
UNVERIFIED_ACCOUNT_REMINDER_LEAD_MINUTES=0.5
UNVERIFIED_ACCOUNT_CLEANUP_INTERVAL_MS=15000
```

For production, set these to seven days and a 24-hour reminder:

```env
UNVERIFIED_ACCOUNT_TTL_MINUTES=10080
UNVERIFIED_ACCOUNT_REMINDER_LEAD_MINUTES=1440
UNVERIFIED_ACCOUNT_CLEANUP_INTERVAL_MS=3600000
```

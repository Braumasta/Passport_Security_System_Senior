# Passport Security Information System

Passport Security is a full-stack passport application and verification system. It includes public information pages, applicant registration, email verification, account document review, passport application submission, staff operations, and admin management.

## Tech Stack

- **Frontend:** React 18, Vite 5, React Router, React Bootstrap, Bootstrap 5
- **Backend:** Node.js, Express, PostgreSQL, JWT authentication
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage buckets for profile photos, account verification files, and passport application documents
- **Email:** Nodemailer SMTP
- **AI/OCR:** Python, Tesseract OCR, Pillow, OpenCV, NumPy, optional Gemini API support for account document extraction

## Main Features

- Applicant account creation with email verification.
- Automatic unverified-account cleanup and reminder emails.
- Account verification using national ID front/back images and selfie upload.
- Staff account document review with extracted ID face, signature, OCR data, and match indicators.
- Passport application flow for first-time, renewal, and lost-passport renewal cases.
- Passport OCR review for uploaded old passport documents.
- Photo ID face comparison against verified ID photo.
- Passport signature comparison against verified national ID signature.
- Staff Operations dashboard for account verification and passport application review.
- Admin Management dashboard for staff accounts and member lookup/editing.
- Supabase-hosted static logo/favicon assets.

## Roles

- **Applicant:** Registers, verifies email, submits account verification, and applies for passports after verification.
- **Officer:** Reviews account documents and passport applications.
- **Admin:** Manages staff access and member data, and can access Operations.

## Local Setup

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

Install Python OCR dependencies:

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ai\requirements.txt
```

Tesseract OCR must also be installed on the machine and available on `PATH`.

## Environment

The backend reads `.env` from the project root and `backend/.env`. Important variables:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
CORS_ORIGIN=http://localhost:5173
APP_BASE_URL=http://localhost:5173

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ACCOUNT_VERIFICATION_BUCKET=account-verification
SUPABASE_PROFILE_PHOTOS_BUCKET=profile-photos
SUPABASE_APPLICATION_DOCUMENTS_BUCKET=application-documents

SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=...
EMAIL_EMBLEM_URL=...

AI_PYTHON_COMMAND=backend\.venv\Scripts\python.exe
GEMINI_API_KEY=...
```

## Run Locally

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend health check: `http://localhost:5000/api/health`

## Build

```bash
npm run build
npm run preview
```

## Key Routes

- `/` - Homepage
- `/register` - Applicant registration
- `/verify-email` - Email verification
- `/login` - Login
- `/account` - My Account and account verification upload
- `/passport-application` - Passport application form, available to verified applicants
- `/operations` - Staff/admin review dashboard
- `/management` - Admin management dashboard
- `/contact` - Contact page
- `/information/:slug` - Public information pages

## Backend API Groups

- `/api/auth` - Login, registration, email verification, password reset
- `/api/users` - Current user, profile, account verification, member lookup
- `/api/applicants` - Applicant profile records
- `/api/applications` - Passport applications and document uploads
- `/api/passports` - Issued passport records

## Notes

- Account verification Python code is in `backend/ai/account_verification_ai.py`.
- Passport application Python OCR code is in `backend/ai/passport_application_ai.py`.
- Frontend place-of-birth options are centralized in `src/data/lebaneseVillages.js`.
- Database schema and migrations are in `backend/sql`.

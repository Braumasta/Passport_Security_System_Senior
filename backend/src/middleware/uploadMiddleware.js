import multer from 'multer';

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const accountVerificationUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }

    return cb(new Error('Account verification files must be JPG, PNG, or WEBP images'));
  },
}).fields([
  { name: 'national_id_front', maxCount: 1 },
  { name: 'national_id_back', maxCount: 1 },
  { name: 'selfie_photo', maxCount: 1 },
]);

export const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }

    return cb(new Error('Profile photo must be JPG, PNG, or WEBP'));
  },
}).single('profile_photo');

export const applicationDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }

    return cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed'));
  },
}).single('file');

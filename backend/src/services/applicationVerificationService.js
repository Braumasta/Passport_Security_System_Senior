import { runPythonAiVerification } from './pythonAiRunner.js';
import { downloadSupabaseFileAsBase64, uploadBufferToSupabase } from './supabaseStorageService.js';
import { env } from '../config/env.js';

const requiredDocumentsByApplicationType = {
  first_time: ['photo_id'],
  renewal: ['photo_id', 'old_passport_copy'],
  renewal_lost: ['photo_id'],
};

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const normalizeDigits = (value) => String(value || '').replace(/\D+/g, '');

const editDistance = (left, right) => {
  if (left === right) return 0;
  if (!left || !right) return Math.max(left.length, right.length);

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + cost
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
};

const normalizeDate = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
};

const valuesMatch = (left, right, type = 'text') => {
  if (type === 'date') return normalizeDate(left) === normalizeDate(right) && Boolean(normalizeDate(left));
  if (type === 'digits') {
    return normalizeDigits(left) === normalizeDigits(right) && Boolean(normalizeDigits(left));
  }
  if (type === 'name') {
    const leftText = normalizeText(left);
    const rightText = normalizeText(right);
    const leftCompact = leftText.replace(/[^a-z0-9]/g, '');
    const rightCompact = rightText.replace(/[^a-z0-9]/g, '');
    const leftTokens = leftText.split(' ').filter(Boolean);
    const rightTokens = rightText.split(' ').filter(Boolean);

    if (!leftText || !rightText) return false;
    if (leftText === rightText) return true;
    if (leftCompact && rightCompact && editDistance(leftCompact, rightCompact) <= 2) return true;
    if (leftTokens.length === 1 && rightTokens.includes(leftTokens[0])) return true;
    if (rightTokens.length === 1 && leftTokens.includes(rightTokens[0])) return true;
    if (editDistance(leftTokens[0] || leftText, rightTokens[0] || rightText) <= 2) return true;

    return (
      leftTokens.length > 0 &&
      rightTokens.length > 0 &&
      (leftTokens.every((token) => rightTokens.includes(token)) ||
        rightTokens.every((token) => leftTokens.includes(token)))
    );
  }
  return normalizeText(left) === normalizeText(right) && Boolean(normalizeText(left));
};

const addMismatch = ({ failures, warnings, label, expected, actual, hard = false, type = 'text' }) => {
  if (!expected || !actual) {
    warnings.push(`${label} could not be fully compared because one value is missing.`);
    return;
  }

  if (!valuesMatch(expected, actual, type)) {
    const message = `${label} does not match verified account data.`;
    if (hard) failures.push(message);
    else warnings.push(message);
  }
};

const parseJsonValue = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};

const getExtractedValue = (source, keys) => {
  if (!source) return null;

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return null;
};

const addDataComparison = ({
  warnings,
  label,
  expected,
  actual,
  expectedSource = 'verified national ID data',
  actualSource = 'submitted application',
  type = 'text',
}) => {
  if (!expected || !actual) {
    warnings.push(`${label} could not be fully compared between ${actualSource} and ${expectedSource}.`);
    return;
  }

  if (!valuesMatch(expected, actual, type)) {
    warnings.push(`${label} from ${actualSource} does not match ${expectedSource}.`);
  }
};

const buildComparisonRow = ({
  field,
  label,
  expected,
  actual,
  expectedSource = 'User Provided',
  actualSource = 'AI Extracted',
  type = 'text',
  match,
}) => ({
  field,
  label,
  expected: expected || '',
  actual: actual || '',
  expected_source: expectedSource,
  actual_source: actualSource,
  match: match ?? Boolean(expected && actual && valuesMatch(expected, actual, type)),
});

const isPassportNumberValid = (value) => /^[A-Za-z0-9/-]{5,30}$/.test(String(value || '').trim());

const buildNotes = ({ status, score, failures, warnings }) =>
  [
    `Application AI status: ${status}`,
    `Score: ${score}/100`,
    failures.length ? `Failed checks: ${failures.join('; ')}` : '',
    warnings.length ? `Warnings: ${warnings.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

export const applicationVerificationService = {
  async reviewApplication({ client, applicationId, reviewedByUserId = null }) {
    const applicationResult = await client.query(
      `
        SELECT
          pa.*,
          a.first_name AS applicant_first_name,
          a.last_name AS applicant_last_name,
          a.father_name AS applicant_father_name,
          a.mother_name AS applicant_mother_name,
          a.date_of_birth AS applicant_date_of_birth,
          a.place_of_birth AS applicant_place_of_birth,
          a.gender AS applicant_gender,
          a.national_id_number AS applicant_national_id_number,
          a.address AS applicant_address,
          u.user_id,
          u.first_name AS account_first_name,
          u.last_name AS account_last_name,
          u.father_name AS account_father_name,
          u.mother_name AS account_mother_name,
          u.date_of_birth AS account_date_of_birth,
          u.place_of_birth AS account_place_of_birth,
          u.gender AS account_gender,
          u.national_id_number AS account_national_id_number,
          u.governorate AS account_governorate,
          u.registry_number AS account_registry_number,
          u.blood_type AS account_blood_type,
          u.marital_status AS account_marital_status,
          u.verification_status AS account_verification_status
        FROM passport_applications pa
        JOIN applicants a ON a.applicant_id = pa.applicant_id
        LEFT JOIN users u ON u.applicant_id = a.applicant_id
        WHERE pa.application_id = $1
      `,
      [applicationId]
    );
    const application = applicationResult.rows[0];

    if (!application) {
      return null;
    }

    const documentsResult = await client.query(
      `
        SELECT document_type, verification_status, file_name, file_path
        FROM documents
        WHERE application_id = $1
      `,
      [applicationId]
    );
    const documents = documentsResult.rows;
    const documentTypes = new Set(documents.map((document) => document.document_type));
    const failures = [];
    const warnings = [];

    const accountVerificationResult = await client.query(
      `
        SELECT extracted_data, signature_image_path
        FROM account_verifications
        WHERE user_id = $1
        ORDER BY account_verification_id DESC
        LIMIT 1
      `,
      [application.user_id]
    );
    const nationalIdData = parseJsonValue(accountVerificationResult.rows[0]?.extracted_data, {});

    if (application.account_verification_status !== 'verified') {
      failures.push('Applicant account is not verified.');
    }

    addMismatch({
      failures,
      warnings,
      label: 'First name',
      expected: application.account_first_name,
      actual: application.applicant_first_name,
      hard: true,
    });
    addMismatch({
      failures,
      warnings,
      label: 'Last name',
      expected: application.account_last_name,
      actual: application.applicant_last_name,
      hard: true,
    });
    addMismatch({
      failures,
      warnings,
      label: 'Father name',
      expected: application.account_father_name,
      actual: application.applicant_father_name,
    });
    addMismatch({
      failures,
      warnings,
      label: 'Mother name',
      expected: application.account_mother_name,
      actual: application.applicant_mother_name,
    });
    addMismatch({
      failures,
      warnings,
      label: 'Date of birth',
      expected: application.account_date_of_birth,
      actual: application.applicant_date_of_birth,
      hard: true,
      type: 'date',
    });
    addMismatch({
      failures,
      warnings,
      label: 'National ID number',
      expected: application.account_national_id_number,
      actual: application.applicant_national_id_number,
      hard: true,
      type: 'digits',
    });
    addMismatch({
      failures,
      warnings,
      label: 'Gender',
      expected: application.account_gender,
      actual: application.applicant_gender,
    });

    if (application.account_registry_number) {
      addMismatch({
        failures,
        warnings,
        label: 'Registry number',
        expected: application.account_registry_number,
        actual: application.registry_number,
        type: 'digits',
      });
    }

    const nationalIdComparisons = [
      {
        label: 'First name',
        keys: ['first_name', 'firstName'],
        actual: application.applicant_first_name,
        type: 'name',
      },
      {
        label: 'Last name',
        keys: ['last_name', 'lastName', 'family_name', 'familyName'],
        actual: application.applicant_last_name,
        type: 'name',
      },
      {
        label: 'Father name',
        keys: ['father_name', 'fatherName'],
        actual: application.applicant_father_name,
        type: 'name',
      },
      {
        label: 'Mother name',
        keys: ['mother_name', 'motherName'],
        actual: application.applicant_mother_name,
        type: 'name',
      },
      {
        label: 'Date of birth',
        keys: ['date_of_birth', 'dateOfBirth', 'birth_date', 'birthDate'],
        actual: application.applicant_date_of_birth,
        type: 'date',
      },
      {
        label: 'Place of birth',
        keys: ['place_of_birth', 'placeOfBirth', 'birth_place', 'birthPlace'],
        actual: application.applicant_place_of_birth,
        type: 'name',
      },
      {
        label: 'National ID number',
        keys: ['national_id_number', 'nationalIdNumber', 'id_number', 'idNumber'],
        actual: application.applicant_national_id_number,
        type: 'digits',
      },
      {
        label: 'Gender',
        keys: ['gender', 'sex'],
        actual: application.applicant_gender,
      },
      {
        label: 'Registry number',
        keys: ['registry_number', 'registryNumber'],
        actual: application.registry_number,
        type: 'digits',
      },
    ];

    for (const comparison of nationalIdComparisons) {
      addDataComparison({
        warnings,
        label: comparison.label,
        expected: getExtractedValue(nationalIdData, comparison.keys),
        actual: comparison.actual,
        type: comparison.type,
      });
    }

    if (!application.passport_type) failures.push('Passport type is missing.');
    if (!application.registry_number) failures.push('Registry number is missing.');
    if (!application.applicant_address) warnings.push('Applicant address is missing.');

    if (application.application_type === 'renewal') {
      if (!application.can_number) failures.push('CAN is missing.');
      if (!application.registry_place) failures.push('Registry place is missing.');

      if (!application.passport_number) {
        failures.push('Previous passport number is required for renewal applications.');
      } else if (!isPassportNumberValid(application.passport_number)) {
        failures.push('Previous passport number format is invalid.');
      }

      if (!application.issuance_date) failures.push('Issuance date is required for renewal applications.');
      if (!application.expiry_date) failures.push('Expiry date is required for renewal applications.');
    }

    if (application.issuance_date && application.expiry_date) {
      const issuedAt = new Date(application.issuance_date);
      const expiresAt = new Date(application.expiry_date);
      if (expiresAt <= issuedAt) failures.push('Passport expiry date must be after issuance date.');
    }

    const requiredDocuments = requiredDocumentsByApplicationType[application.application_type] || [];
    for (const requiredDocument of requiredDocuments) {
      if (!documentTypes.has(requiredDocument)) {
        failures.push(`Missing required document: ${requiredDocument.replace(/_/g, ' ')}.`);
      }
    }

    const rejectedDocument = documents.find((document) => document.verification_status === 'rejected');
    if (rejectedDocument) {
      failures.push(`A submitted document was rejected: ${rejectedDocument.document_type.replace(/_/g, ' ')}.`);
    }

    let pythonAnalysis = null;
    let uploadedPassportPhoto = null;
    let uploadedPassportSignature = null;
    let uploadedPassportMrz = null;
    let uploadedNationalIdSignature = null;
    try {
      const accountFilesResult = await client.query(
        `
          SELECT document_type, file_name, file_path
          FROM user_verification_files
          WHERE user_id = $1
            AND account_verification_id = (
              SELECT account_verification_id
              FROM account_verifications
              WHERE user_id = $1
              ORDER BY account_verification_id DESC
              LIMIT 1
            )
        `,
        [application.user_id]
      );

      const filesWithContent = await Promise.all(
        documents.map(async (document) => ({
          ...document,
          content_base64: await downloadSupabaseFileAsBase64(document.file_path),
        }))
      );
      const accountFilesWithContent = await Promise.all(
        accountFilesResult.rows.map(async (file) => ({
          ...file,
          content_base64: await downloadSupabaseFileAsBase64(file.file_path),
        }))
      );

      pythonAnalysis = await runPythonAiVerification({
        mode: 'passport',
        payload: {
          application: {
            ...application,
            first_name: application.applicant_first_name,
            last_name: application.applicant_last_name,
            father_name: application.applicant_father_name,
            mother_name: application.applicant_mother_name,
            date_of_birth: application.applicant_date_of_birth,
            place_of_birth: application.applicant_place_of_birth,
            gender: application.applicant_gender,
            national_id_number: application.applicant_national_id_number,
          },
          user: {
            first_name: application.account_first_name,
            last_name: application.account_last_name,
            father_name: application.account_father_name,
            mother_name: application.account_mother_name,
            date_of_birth: application.account_date_of_birth,
            place_of_birth: application.account_place_of_birth,
            gender: application.account_gender,
            national_id_number: application.account_national_id_number,
            registry_number: application.account_registry_number,
            blood_type: application.account_blood_type,
            marital_status: application.account_marital_status,
          },
          national_id_data: nationalIdData,
          files: filesWithContent,
          account_files: accountFilesWithContent,
        },
      });

      warnings.push(...(pythonAnalysis.warnings || []));
      failures.push(...(pythonAnalysis.failures || []));

      if (
        application.application_type === 'renewal' &&
        pythonAnalysis.extracted &&
        pythonAnalysis.extracted._ocr_confidence !== 'low'
      ) {
        const passportComparisons = [
          {
            label: 'Passport first name',
            keys: ['first_name', 'firstName'],
            applicationValue: application.applicant_first_name,
            type: 'name',
          },
          {
            label: 'Passport last name',
            keys: ['last_name', 'lastName', 'family_name', 'familyName'],
            applicationValue: application.applicant_last_name,
            type: 'name',
          },
          {
            label: 'Passport father name',
            keys: ['father_name', 'fatherName'],
            applicationValue: application.applicant_father_name,
            type: 'name',
          },
          {
            label: 'Passport mother name',
            keys: ['mother_name', 'motherName'],
            applicationValue: application.applicant_mother_name,
            type: 'name',
          },
          {
            label: 'Passport date of birth',
            keys: ['date_of_birth', 'dateOfBirth', 'birth_date', 'birthDate'],
            applicationValue: application.applicant_date_of_birth,
            type: 'date',
          },
          {
            label: 'Passport place of birth',
            keys: ['place_of_birth', 'placeOfBirth', 'birth_place', 'birthPlace'],
            applicationValue: application.applicant_place_of_birth,
            type: 'name',
          },
          {
            label: 'Passport registry number',
            keys: ['registry_number', 'registryNumber'],
            applicationValue: application.registry_number,
            type: 'digits',
            compareNationalId: true,
          },
          {
            label: 'Previous passport number',
            keys: ['passport_number', 'passportNumber'],
            applicationValue: application.passport_number,
            type: 'text',
            compareNationalId: false,
          },
          {
            label: 'CAN',
            keys: ['can_number', 'canNumber', 'can'],
            applicationValue: application.can_number,
            type: 'digits',
            compareNationalId: false,
          },
        ];

        for (const comparison of passportComparisons) {
          const passportValue = getExtractedValue(pythonAnalysis.extracted, comparison.keys);
          addDataComparison({
            warnings,
            label: comparison.label,
            expected: comparison.applicationValue,
            actual: passportValue,
            expectedSource: 'submitted application',
            actualSource: 'passport OCR',
            type: comparison.type,
          });

          if (comparison.compareNationalId !== false) {
            addDataComparison({
              warnings,
              label: comparison.label,
              expected: getExtractedValue(nationalIdData, comparison.keys),
              actual: passportValue,
              expectedSource: 'verified national ID data',
              actualSource: 'passport OCR',
              type: comparison.type,
            });
          }
        }
      }

      if (pythonAnalysis.extracted_assets?.passport_photo) {
        uploadedPassportPhoto = await uploadBufferToSupabase({
          bucket: env.supabaseApplicationDocumentsBucket,
          folder: `applications/${applicationId}/extracted`,
          buffer: Buffer.from(pythonAnalysis.extracted_assets.passport_photo, 'base64'),
          fileName: 'passport-photo.png',
          contentType: 'image/png',
        });
      }

      if (pythonAnalysis.extracted_assets?.signature) {
        uploadedPassportSignature = await uploadBufferToSupabase({
          bucket: env.supabaseApplicationDocumentsBucket,
          folder: `applications/${applicationId}/extracted`,
          buffer: Buffer.from(pythonAnalysis.extracted_assets.signature, 'base64'),
          fileName: 'passport-signature.png',
          contentType: 'image/png',
        });
      }

      if (pythonAnalysis.extracted_assets?.mrz) {
        uploadedPassportMrz = await uploadBufferToSupabase({
          bucket: env.supabaseApplicationDocumentsBucket,
          folder: `applications/${applicationId}/extracted`,
          buffer: Buffer.from(pythonAnalysis.extracted_assets.mrz, 'base64'),
          fileName: 'passport-data-strip.png',
          contentType: 'image/png',
        });
      }

      if (pythonAnalysis.extracted_assets?.national_id_signature) {
        uploadedNationalIdSignature = await uploadBufferToSupabase({
          bucket: env.supabaseApplicationDocumentsBucket,
          folder: `applications/${applicationId}/extracted`,
          buffer: Buffer.from(pythonAnalysis.extracted_assets.national_id_signature, 'base64'),
          fileName: 'national-id-signature.png',
          contentType: 'image/png',
        });
      }

      if (!uploadedNationalIdSignature && accountVerificationResult.rows[0]?.signature_image_path) {
        uploadedNationalIdSignature = {
          storageReference: accountVerificationResult.rows[0].signature_image_path,
        };
      }
    } catch (error) {
      warnings.push(`Passport OCR could not be completed automatically: ${error.message}`);
    }

    let status = 'ai_verified';
    if (failures.length || warnings.length) status = 'pending_ai_review';

    let score = 100;
    score -= failures.length * 18;
    score -= warnings.length * 8;
    score = Math.max(0, Math.min(100, score));
    const extractedPassportData = pythonAnalysis?.extracted || {};
    const comparisonRows =
      application.application_type === 'renewal'
        ? [
            buildComparisonRow({
              field: 'first_name',
              label: 'First Name',
              expected: application.applicant_first_name,
              actual: extractedPassportData.first_name,
              expectedSource: 'User Provided',
              actualSource: 'Passport OCR',
              type: 'name',
            }),
            buildComparisonRow({
              field: 'last_name',
              label: 'Last Name',
              expected: application.applicant_last_name,
              actual: extractedPassportData.last_name,
              expectedSource: 'User Provided',
              actualSource: 'Passport OCR',
              type: 'name',
            }),
            buildComparisonRow({
              field: 'father_name',
              label: 'Father Name',
              expected: application.applicant_father_name,
              actual: extractedPassportData.father_name,
              expectedSource: 'User Provided',
              actualSource: 'Passport OCR',
              type: 'name',
            }),
            buildComparisonRow({
              field: 'mother_name',
              label: 'Mother Name',
              expected: application.applicant_mother_name,
              actual: extractedPassportData.mother_name,
              expectedSource: 'User Provided',
              actualSource: 'Passport OCR',
              type: 'name',
            }),
            buildComparisonRow({
              field: 'date_of_birth',
              label: 'Date of Birth',
              expected: application.applicant_date_of_birth,
              actual: extractedPassportData.date_of_birth,
              expectedSource: 'User Provided',
              actualSource: 'Passport OCR',
              type: 'date',
            }),
            buildComparisonRow({
              field: 'place_of_birth',
              label: 'Place of Birth',
              expected: application.applicant_place_of_birth,
              actual: extractedPassportData.place_of_birth,
              expectedSource: 'User Provided',
              actualSource: 'Passport OCR',
              type: 'name',
            }),
            buildComparisonRow({
              field: 'gender',
              label: 'Gender',
              expected: application.applicant_gender,
              actual: extractedPassportData.gender,
              expectedSource: 'User Provided',
              actualSource: 'Passport OCR',
            }),
            buildComparisonRow({
              field: 'national_id_number',
              label: 'National ID Number',
              expected: application.applicant_national_id_number,
              actual: getExtractedValue(nationalIdData, ['national_id_number', 'nationalIdNumber', 'id_number', 'idNumber']),
              expectedSource: 'User Provided',
              actualSource: 'Latest ID Verification',
              type: 'digits',
            }),
            buildComparisonRow({
              field: 'passport_number',
              label: 'Passport Number',
              expected: application.passport_number,
              actual: extractedPassportData.passport_number,
              expectedSource: 'User Provided',
              actualSource: 'Passport OCR',
            }),
            buildComparisonRow({
              field: 'can_number',
              label: 'CAN',
              expected: application.can_number,
              actual: extractedPassportData.can_number,
              expectedSource: 'User Provided',
              actualSource: 'Passport OCR',
              type: 'digits',
            }),
            buildComparisonRow({
              field: 'registry_number',
              label: 'Registry Number',
              expected: application.registry_number,
              actual: extractedPassportData.registry_number,
              expectedSource: 'User Provided',
              actualSource: 'Passport OCR',
              type: 'digits',
            }),
            buildComparisonRow({
              field: 'signature',
              label: 'Signature',
              expected: 'National ID signature',
              actual:
                extractedPassportData.signature_match_score !== undefined
                  ? `${Math.round(Number(extractedPassportData.signature_match_score))}%`
                  : '',
              expectedSource: 'National ID Data',
              actualSource: 'Passport Signature',
              match:
                extractedPassportData.signature_match_score !== undefined &&
                Number(extractedPassportData.signature_match_score) >= 45,
            }),
          ]
        : [
            buildComparisonRow({
              field: 'first_name',
              label: 'First Name',
              expected: application.applicant_first_name,
              actual: getExtractedValue(nationalIdData, ['first_name', 'firstName']),
              type: 'name',
            }),
            buildComparisonRow({
              field: 'last_name',
              label: 'Last Name',
              expected: application.applicant_last_name,
              actual: getExtractedValue(nationalIdData, ['last_name', 'lastName', 'family_name', 'familyName']),
              type: 'name',
            }),
            buildComparisonRow({
              field: 'father_name',
              label: 'Father Name',
              expected: application.applicant_father_name,
              actual: getExtractedValue(nationalIdData, ['father_name', 'fatherName']),
              type: 'name',
            }),
            buildComparisonRow({
              field: 'mother_name',
              label: 'Mother Name',
              expected: application.applicant_mother_name,
              actual: getExtractedValue(nationalIdData, ['mother_name', 'motherName']),
              type: 'name',
            }),
            buildComparisonRow({
              field: 'date_of_birth',
              label: 'Date of Birth',
              expected: application.applicant_date_of_birth,
              actual: getExtractedValue(nationalIdData, ['date_of_birth', 'dateOfBirth', 'birth_date', 'birthDate']),
              type: 'date',
            }),
            buildComparisonRow({
              field: 'place_of_birth',
              label: 'Place of Birth',
              expected: application.applicant_place_of_birth,
              actual: getExtractedValue(nationalIdData, ['place_of_birth', 'placeOfBirth', 'birth_place', 'birthPlace']),
              type: 'name',
            }),
            buildComparisonRow({
              field: 'national_id_number',
              label: 'National ID Number',
              expected: application.applicant_national_id_number,
              actual: getExtractedValue(nationalIdData, ['national_id_number', 'nationalIdNumber', 'id_number', 'idNumber']),
              type: 'digits',
            }),
            buildComparisonRow({
              field: 'gender',
              label: 'Gender',
              expected: application.applicant_gender,
              actual: getExtractedValue(nationalIdData, ['gender', 'sex']),
            }),
            buildComparisonRow({
              field: 'registry_number',
              label: 'Registry Number',
              expected: application.registry_number,
              actual: getExtractedValue(nationalIdData, ['registry_number', 'registryNumber']),
              type: 'digits',
            }),
          ];
    const aiExtractedData = {
      ...extractedPassportData,
      _comparison_rows: comparisonRows,
      _national_id_data: nationalIdData,
      _application_type: application.application_type,
    };
    const notes = [
      buildNotes({ status, score, failures, warnings }),
      pythonAnalysis?.notes || '',
      Object.keys(extractedPassportData).length ? `Extracted passport data: ${JSON.stringify(extractedPassportData)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const updateResult = await client.query(
      `
        UPDATE passport_applications
        SET
          status = $1,
          notes = $2,
          reviewed_by = COALESCE($3, reviewed_by),
          reviewed_at = CURRENT_TIMESTAMP,
          ai_score = $5,
          ai_extracted_data = $6,
          ai_failures = $7,
          ai_warnings = $8,
          passport_photo_image_path = COALESCE($9, passport_photo_image_path),
          passport_signature_image_path = COALESCE($10, passport_signature_image_path),
          passport_mrz_image_path = COALESCE($11, passport_mrz_image_path),
          national_id_signature_image_path = COALESCE($12, national_id_signature_image_path),
          updated_at = CURRENT_TIMESTAMP
        WHERE application_id = $4
        RETURNING *
      `,
      [
        status,
        notes,
        reviewedByUserId,
        applicationId,
        score,
        JSON.stringify(aiExtractedData),
        JSON.stringify(failures),
        JSON.stringify(warnings),
        uploadedPassportPhoto?.storageReference || null,
        uploadedPassportSignature?.storageReference || null,
        uploadedPassportMrz?.storageReference || null,
        uploadedNationalIdSignature?.storageReference || null,
      ]
    );

    return {
      status,
      score,
      failures,
      warnings,
      notes,
      extracted: aiExtractedData,
      application: updateResult.rows[0],
    };
  },
};

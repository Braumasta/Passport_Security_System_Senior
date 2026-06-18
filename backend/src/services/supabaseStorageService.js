import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

let supabaseClient = null;

const getSupabaseClient = () => {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new ApiError(
      500,
      'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env'
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
};

const sanitizeName = (value, fallback = 'file') => {
  const extension = path.extname(value || '').toLowerCase();
  const baseName =
    path
      .basename(value || fallback, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || fallback;

  return `${baseName}${extension}`;
};

export const buildStorageReference = (bucket, objectPath) => `supabase://${bucket}/${objectPath}`;

export const parseStorageReference = (value) => {
  if (!value?.startsWith('supabase://')) {
    return null;
  }

  const withoutProtocol = value.replace('supabase://', '');
  const slashIndex = withoutProtocol.indexOf('/');

  if (slashIndex === -1) {
    return null;
  }

  return {
    bucket: withoutProtocol.slice(0, slashIndex),
    objectPath: withoutProtocol.slice(slashIndex + 1),
  };
};

export const uploadFileToSupabase = async ({ bucket, folder, file }) => {
  if (!file?.buffer) {
    throw new ApiError(400, 'A file upload is required');
  }

  const supabase = getSupabaseClient();
  const safeFileName = sanitizeName(file.originalname);
  const objectPath = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeFileName}`;

  const { error } = await supabase.storage.from(bucket).upload(objectPath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) {
    throw new ApiError(500, `Supabase upload failed: ${error.message}`);
  }

  return {
    bucket,
    objectPath,
    fileName: file.originalname,
    storageReference: buildStorageReference(bucket, objectPath),
  };
};

export const uploadBufferToSupabase = async ({ bucket, folder, buffer, fileName, contentType }) => {
  if (!buffer?.length) {
    return null;
  }

  const supabase = getSupabaseClient();
  const safeFileName = sanitizeName(fileName);
  const objectPath = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeFileName}`;

  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new ApiError(500, `Supabase upload failed: ${error.message}`);
  }

  return {
    bucket,
    objectPath,
    fileName,
    storageReference: buildStorageReference(bucket, objectPath),
  };
};

export const deleteSupabaseFile = async (storageReference) => {
  const parsedReference = parseStorageReference(storageReference);

  if (!parsedReference) {
    return;
  }

  const supabase = getSupabaseClient();
  await supabase.storage
    .from(parsedReference.bucket)
    .remove([parsedReference.objectPath])
    .catch(() => {});
};

export const createSignedStorageUrl = async (storageReference, expiresInSeconds = 60 * 60) => {
  const parsedReference = parseStorageReference(storageReference);

  if (!parsedReference) {
    return storageReference || '';
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(parsedReference.bucket)
    .createSignedUrl(parsedReference.objectPath, expiresInSeconds);

  if (error) {
    return '';
  }

  return data?.signedUrl || '';
};

export const downloadSupabaseFileAsBase64 = async (storageReference) => {
  const parsedReference = parseStorageReference(storageReference);

  if (!parsedReference) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(parsedReference.bucket)
    .download(parsedReference.objectPath);

  if (error) {
    throw new ApiError(500, `Supabase download failed: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();

  return Buffer.from(arrayBuffer).toString('base64');
};

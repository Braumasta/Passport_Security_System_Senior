import crypto from 'crypto';

export const generatePlainToken = () => crypto.randomBytes(32).toString('hex');

export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const generateSixDigitCode = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, '0');

export const generateEightDigitCode = () =>
  crypto.randomInt(0, 100000000).toString().padStart(8, '0');

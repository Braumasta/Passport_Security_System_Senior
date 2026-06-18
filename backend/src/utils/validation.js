export const addError = (errors, field, message) => {
  errors.push({ field, message });
};

export const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

export const isOptionalString = (value) =>
  value === undefined || value === null || typeof value === 'string';

export const isValidEmail = (value) =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isValidDate = (value) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

export const isPositiveInteger = (value) => {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0;
};

export const isInEnum = (value, allowedValues) => allowedValues.includes(value);

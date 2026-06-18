export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';

  if (error.code === '23505') {
    statusCode = 409;
    message = 'A record with the same unique value already exists';
  }

  if (error.code === '23503') {
    statusCode = 400;
    message = 'The request references a related record that does not exist';
  }

  if (error.code === '22P02') {
    statusCode = 400;
    message = 'One of the provided values has an invalid format';
  }

  if (error.name === 'MulterError') {
    statusCode = 400;
    message = error.message || 'File upload failed';
  }

  if (message === 'Only JPG, PNG, WEBP, and PDF files are allowed') {
    statusCode = 400;
  }

  res.status(statusCode).json({
    message,
    errors: error.details || null,
  });
};

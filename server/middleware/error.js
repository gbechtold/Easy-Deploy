/**
 * Error handling middleware
 */
module.exports = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error status
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Don't expose internal errors in production
  const response = {
    error: message,
    status: status
  };

  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};

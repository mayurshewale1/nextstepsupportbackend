const config = require('../config/env');

class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Log error (in production, use proper logging)
  console.error('Error:', err.message);
  if (!config.isProduction) {
    console.error(err.stack);
  }

  // PostgreSQL errors
  if (err.code === '23505') {
    return res.status(400).json({
      success: false,
      message: 'Duplicate value - record already exists',
    });
  }
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(config.nodeEnv === 'development' && { error: err.message }),
  });
};

module.exports = { AppError, errorHandler };

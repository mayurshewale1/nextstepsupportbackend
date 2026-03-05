const { body, validationResult } = require('express-validator');

const loginRules = [
  body('userId').trim().notEmpty().withMessage('userId or email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
  });
};

module.exports = { loginRules, changePasswordRules, validate };

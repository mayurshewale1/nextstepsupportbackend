const { body, param, validationResult } = require('express-validator');

const createUserRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Name cannot be empty'),
  body('role').optional().isIn(['admin', 'Admin', 'engineer', 'Engineer', 'user', 'User', 'area_head', 'Area Head']).withMessage('Invalid role'),
  body('phone').optional().trim(),
  body('userId').optional().trim(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('siteName').optional().trim(),
  body('siteAddress').optional().trim(),
  body('siteType').optional().trim(),
];

const updateUserRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),
  body('email').optional().isEmail().normalizeEmail(),
  body('name').optional().trim(),
  body('role').optional().isIn(['admin', 'Admin', 'engineer', 'Engineer', 'user', 'User']),
  body('phone').optional().trim(),
  body('userId').optional().trim(),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
];

const updateLocationRules = [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
];

const idParamRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),
];

const resetPasswordRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const bulkResetPasswordRules = [
  body('userIds').isArray({ min: 1 }).withMessage('User IDs array is required'),
  body('userIds.*').isInt({ min: 1 }).withMessage('Invalid user ID in array'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
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

module.exports = { 
  createUserRules, 
  updateUserRules, 
  updateLocationRules, 
  idParamRules, 
  resetPasswordRules,
  bulkResetPasswordRules,
  validate 
};

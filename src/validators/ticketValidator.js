const { body, param, query, validationResult } = require('express-validator');

const createTicketRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('category').optional().trim(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
];

const updateTicketRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ticket ID'),
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim().notEmpty(),
  body('status').optional().isIn(['open', 'in-progress', 'completed', 'resolved', 'closed']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('category').optional().trim(),
  body('assigned_to').optional().isInt({ min: 1 }),
  body('rating').optional().isInt({ min: 1, max: 5 }),
];

const assignTicketRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ticket ID'),
  body('assignedTo').toInt().isInt({ min: 1 }).withMessage('assignedTo (user id) is required'),
];

const idParamRules = [
  param('id').isInt({ min: 1 }).withMessage('Invalid ticket ID'),
];

const getTicketsQueryRules = [
  query('period').optional().isIn(['today', 'yesterday', 'weekly', 'monthly', 'yearly']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('status').optional().isIn(['open', 'in-progress', 'completed', 'resolved', 'closed']),
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
  createTicketRules,
  updateTicketRules,
  assignTicketRules,
  idParamRules,
  getTicketsQueryRules,
  validate,
};

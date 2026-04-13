const { Router } = require('express');
const UserController = require('../controllers/UserController');
const AuthController = require('../controllers/AuthController');
const TicketController = require('../controllers/TicketController');
const VisitController = require('../controllers/visitController');
const NotificationController = require('../controllers/NotificationController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { loginRules, changePasswordRules, validate: authValidate } = require('../validators/authValidator');
const {
  createUserRules,
  updateUserRules,
  updateLocationRules,
  idParamRules: userIdRules,
  resetPasswordRules,
  validate: userValidate,
} = require('../validators/userValidator');
const {
  createTicketRules,
  updateTicketRules,
  assignTicketRules,
  idParamRules: ticketIdRules,
  getTicketsQueryRules,
  validate: ticketValidate,
} = require('../validators/ticketValidator');
const upload = require('../middleware/upload');

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API info
router.get('/info', (req, res) => {
  res.status(200).json({
    name: 'NextStep Backend API',
    version: process.env.API_VERSION || 'v1',
    description: 'Backend API for NextStep Support App',
  });
});

// Auth
router.post('/auth/login', loginRules, authValidate, AuthController.login);
router.post('/auth/admin/send-otp', AuthController.sendAdminOtp);
router.post('/auth/admin/verify-otp', AuthController.verifyAdminOtp);
router.put('/auth/change-password', authenticateToken, changePasswordRules, authValidate, AuthController.changePassword);

// Users (public create for registration; protected CRUD for admin)
router.post('/users', createUserRules, userValidate, UserController.createUser);
router.get('/users/me', authenticateToken, UserController.getCurrentUser);
router.get('/users', authenticateToken, authorizeRoles('Admin'), UserController.getAllUsers);
router.get('/users/area-heads/list', authenticateToken, UserController.getAreaHeads);
router.get('/users/:id', authenticateToken, userIdRules, userValidate, UserController.getUserById);
router.put('/users/me/location', authenticateToken, authorizeRoles('Engineer'), updateLocationRules, userValidate, UserController.updateMyLocation);
router.put('/users/:id', authenticateToken, authorizeRoles('Admin'), updateUserRules, userValidate, UserController.updateUser);
router.put('/users/:id/reset-password', authenticateToken, resetPasswordRules, userValidate, UserController.resetUserPassword);
router.post('/users/bulk-reset-password', authenticateToken, authorizeRoles('Admin'), UserController.bulkResetPasswords);
router.delete('/users/:id', authenticateToken, authorizeRoles('Admin'), userIdRules, userValidate, UserController.deleteUser);

// Notification device tokens
router.post(
  '/notifications/device-token',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'User'),
  NotificationController.registerDeviceToken
);
router.delete(
  '/notifications/device-token',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'User'),
  NotificationController.unregisterDeviceToken
);

// Tickets
router.get(
  '/tickets',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'User'),
  getTicketsQueryRules,
  ticketValidate,
  TicketController.getTickets
);
router.get(
  '/tickets/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'User'),
  ticketIdRules,
  ticketValidate,
  TicketController.getTicketById
);
router.post(
  '/tickets',
  authenticateToken,
  authorizeRoles('User', 'Admin'),
  createTicketRules,
  ticketValidate,
  TicketController.createTicket
);
router.post(
  '/tickets/with-image',
  authenticateToken,
  authorizeRoles('User', 'Admin'),
  upload.array('images', 5), // Allow up to 5 images
  TicketController.createTicketWithImage
);
router.put(
  '/tickets/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer'),
  updateTicketRules,
  ticketValidate,
  TicketController.updateTicket
);
router.put(
  '/tickets/:id/assign',
  authenticateToken,
  authorizeRoles('Admin'),
  assignTicketRules,
  ticketValidate,
  TicketController.assignTicket
);
router.put(
  '/tickets/:id/feedback',
  authenticateToken,
  authorizeRoles('User', 'Admin'),
  ticketIdRules,
  ticketValidate,
  TicketController.submitFeedback
);
router.delete(
  '/tickets/:id',
  authenticateToken,
  authorizeRoles('Admin'),
  ticketIdRules,
  ticketValidate,
  TicketController.deleteTicket
);

// Preventive Maintenance Visits (AMC)
router.post(
  '/visits',
  authenticateToken,
  authorizeRoles('Admin'),
  VisitController.createVisit
);
router.get(
  '/visits',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer'),
  VisitController.getVisits
);
router.get(
  '/visits/my-visits',
  authenticateToken,
  authorizeRoles('Engineer'),
  VisitController.getMyVisits
);
router.get(
  '/visits/overdue',
  authenticateToken,
  authorizeRoles('Admin'),
  VisitController.getOverdueVisits
);
router.get(
  '/visits/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer'),
  VisitController.getVisitById
);
router.put(
  '/visits/:id',
  authenticateToken,
  authorizeRoles('Admin'),
  VisitController.updateVisit
);
router.put(
  '/visits/:id/complete',
  authenticateToken,
  authorizeRoles('Engineer', 'Admin'),
  VisitController.completeVisit
);
router.delete(
  '/visits/:id',
  authenticateToken,
  authorizeRoles('Admin'),
  VisitController.deleteVisit
);
router.get(
  '/visits/user/:userId/stats',
  authenticateToken,
  authorizeRoles('Admin'),
  VisitController.getUserVisitStats
);
router.get(
  '/visits/user/:userId/check',
  authenticateToken,
  authorizeRoles('Admin'),
  VisitController.checkVisitNeeded
);

// Protected dashboard routes
router.get('/dashboard', authenticateToken, authorizeRoles('User'), (req, res) => {
  res.json({ message: 'User dashboard', user: req.user });
});
router.get('/admin/dashboard', authenticateToken, authorizeRoles('Admin'), (req, res) => {
  res.json({ message: 'Admin dashboard', user: req.user });
});
router.get('/engineer/dashboard', authenticateToken, authorizeRoles('Engineer'), (req, res) => {
  res.json({ message: 'Engineer dashboard', user: req.user });
});

module.exports = router;

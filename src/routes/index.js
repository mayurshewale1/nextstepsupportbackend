const { Router } = require('express');
const UserController = require('../controllers/UserController');
const AuthController = require('../controllers/AuthController');
const TicketController = require('../controllers/TicketController');
const VisitController = require('../controllers/visitController');
const NotificationController = require('../controllers/NotificationController');
const ReportController = require('../controllers/ReportController');
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

// Database test - check schema
const Database = require('../config/database');
router.get('/db-test', async (req, res) => {
  try {
    // Test users table columns
    const columnCheck = await Database.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('state', 'area', 'area_head_id')
    `);
    
    // Test if preventive_visits table exists
    const tableCheck = await Database.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'preventive_visits'
      ) as exists
    `);
    
    // Count users
    const userCount = await Database.query('SELECT COUNT(*) as count FROM users');
    
    res.status(200).json({
      success: true,
      database: 'connected',
      userColumns: columnCheck.rows.map(r => r.column_name),
      visitsTableExists: tableCheck.rows[0]?.exists || false,
      totalUsers: parseInt(userCount.rows[0]?.count || 0),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
    });
  }
});

// Auth
router.post('/auth/login', loginRules, authValidate, AuthController.login);
router.post('/auth/admin/send-otp', AuthController.sendAdminOtp);
router.post('/auth/admin/verify-otp', AuthController.verifyAdminOtp);
router.post('/auth/logout', authenticateToken, AuthController.logout);
router.get('/auth/sessions', authenticateToken, AuthController.getActiveSessions);
router.put('/auth/change-password', authenticateToken, changePasswordRules, authValidate, AuthController.changePassword);

// Users (public create for registration; protected CRUD for admin)
router.post('/users', createUserRules, userValidate, UserController.createUser);
router.get('/users/me', authenticateToken, UserController.getCurrentUser);
router.get('/users', authenticateToken, authorizeRoles('Admin', 'area_head'), UserController.getAllUsers);
router.get('/users/area-heads/list', authenticateToken, UserController.getAreaHeads);
router.get('/users/my-assigned-users', authenticateToken, authorizeRoles('area_head'), UserController.getMyAssignedUsers);
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
router.get(
  '/notifications/my-tokens',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'User'),
  NotificationController.getMyTokens
);
router.post(
  '/notifications/test',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'User'),
  NotificationController.sendTest
);

// Tickets
router.get(
  '/tickets',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'User', 'area_head'),
  getTicketsQueryRules,
  ticketValidate,
  TicketController.getTickets
);
router.get(
  '/tickets/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'User', 'area_head'),
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
  upload.fields([{ name: 'images', maxCount: 5 }, { name: 'video', maxCount: 1 }]), // Allow up to 5 images and 1 video
  TicketController.createTicketWithImage
);
router.put(
  '/tickets/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'area_head'),
  updateTicketRules,
  ticketValidate,
  TicketController.updateTicket
);
router.put(
  '/tickets/:id/assign',
  authenticateToken,
  authorizeRoles('Admin', 'area_head'),
  assignTicketRules,
  ticketValidate,
  TicketController.assignTicket
);
router.post(
  '/tickets/:id/verify-completion',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'User'),
  ticketIdRules,
  ticketValidate,
  TicketController.verifyTicketCompletion
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
  authorizeRoles('Admin', 'area_head'),
  VisitController.createVisit
);
router.get(
  '/visits',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'User', 'area_head'),
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
  authorizeRoles('Admin', 'area_head'),
  VisitController.getOverdueVisits
);
router.get(
  '/visits/:id',
  authenticateToken,
  authorizeRoles('Admin', 'Engineer', 'area_head'),
  VisitController.getVisitById
);
router.put(
  '/visits/:id',
  authenticateToken,
  authorizeRoles('Admin', 'area_head'),
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
  authorizeRoles('Admin', 'area_head'),
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

// Reports
router.get(
  '/reports/tickets-excel',
  authenticateToken,
  authorizeRoles('Admin', 'area_head'),
  ReportController.downloadTicketsExcel
);
router.get(
  '/reports/engineer/:id/tickets-excel',
  authenticateToken,
  authorizeRoles('Admin', 'area_head'),
  ReportController.downloadEngineerTicketsExcel
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

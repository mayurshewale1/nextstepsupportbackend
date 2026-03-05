const { Router } = require('express');
const UserController = require('../controllers/UserController');
const AuthController = require('../controllers/AuthController');
const TicketController = require('../controllers/TicketController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { loginRules, changePasswordRules, validate: authValidate } = require('../validators/authValidator');
const {
  createUserRules,
  updateUserRules,
  idParamRules: userIdRules,
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
router.put('/auth/change-password', authenticateToken, changePasswordRules, authValidate, AuthController.changePassword);

// Users (public create for registration; protected CRUD for admin)
router.post('/users', createUserRules, userValidate, UserController.createUser);
router.get('/users', UserController.getAllUsers);
router.get('/users/:id', authenticateToken, userIdRules, userValidate, UserController.getUserById);
router.put('/users/:id', authenticateToken, authorizeRoles('Admin'), updateUserRules, userValidate, UserController.updateUser);
router.delete('/users/:id', authenticateToken, authorizeRoles('Admin'), userIdRules, userValidate, UserController.deleteUser);

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
router.delete(
  '/tickets/:id',
  authenticateToken,
  authorizeRoles('Admin'),
  ticketIdRules,
  ticketValidate,
  TicketController.deleteTicket
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

const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Middleware to verify JWT and attach user to request
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Middleware for role-based access (case-insensitive)
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(403).json({ success: false, message: 'Access denied' });
    const userRole = (req.user.role || '').toLowerCase();
    const allowed = roles.map(r => r.toLowerCase());
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRoles };

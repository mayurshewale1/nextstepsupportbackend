require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config/env');
const Database = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');
const { initSocket } = require('./socket');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Validate environment before starting
try {
  config.validateEnv();
} catch (err) {
  console.error('✗', err.message);
  process.exit(1);
}

// Security middleware
app.use(helmet());
// CORS: allow any origin so web app works from anywhere (localhost, Vercel, IP, deployed URL)
app.use(cors({ origin: true, credentials: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 100 : 1000,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// No strict rate limit on auth - device limit is enforced instead
// Users can attempt login unlimited times, but device sessions are limited to 2 per user

// Body parsing with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploaded images (before /api routes)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Initialize Socket.IO
initSocket(server);

// Routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await Database.connect();

    server.listen(config.port, () => {
      console.log(`\n✓ Server running on http://localhost:${config.port}`);
      console.log(`✓ Environment: ${config.nodeEnv}`);
      console.log(`✓ API Version: ${config.apiVersion}\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received. Shutting down gracefully...');
  await Database.disconnect();
  process.exit(0);
});

module.exports = app;

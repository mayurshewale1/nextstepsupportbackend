require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'your_secret_key',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  corsOrigin:
    process.env.CORS_ORIGIN ||
    'http://localhost:3000,http://localhost:5000,http://127.0.0.1:3000,http://127.0.0.1:5000,https://nextstep.mayurr.in,https://www.nextstep.mayurr.in',
  apiVersion: process.env.API_VERSION || 'v1',
  isProduction: process.env.NODE_ENV === 'production',
};

function validateEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (config.isProduction && config.jwtSecret === 'your_secret_key') {
    throw new Error('JWT_SECRET must be changed in production');
  }
}

module.exports = config;
module.exports.validateEnv = validateEnv;

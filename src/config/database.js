const { Pool } = require('pg');

// Configure SSL based on environment and connection string
const getPoolConfig = () => {
  const config = {
    connectionString: process.env.DATABASE_URL,
  };

  // Use SSL for Neon cloud database
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon')) {
    config.ssl = {
      rejectUnauthorized: false,
    };
  } else if (process.env.NODE_ENV === 'production') {
    config.ssl = {
      rejectUnauthorized: false,
    };
  }

  return config;
};

const pool = new Pool(getPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

class Database {
  static async connect() {
    try {
      const client = await pool.connect();
      console.log('✓ Connected to Neon PostgreSQL database');
      client.release();
    } catch (error) {
      console.error('✗ Failed to connect to database:', error);
      throw error;
    }
  }

  static async query(text, params) {
    return pool.query(text, params);
  }

  static async getClient() {
    return pool.connect();
  }

  static async disconnect() {
    await pool.end();
    console.log('✓ Disconnected from database');
  }
}

module.exports = Database;

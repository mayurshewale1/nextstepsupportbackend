#!/usr/bin/env node
/**
 * Seed initial admin user
 * Usage: node scripts/seed-admin.js
 * Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME via env or defaults below
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false,
});

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@demo.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Admin User';
  const userId = process.env.ADMIN_USER_ID || 'admin1';

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const res = await pool.query(
      `INSERT INTO users (user_id, email, password, name, role)
       VALUES ($1, $2, $3, $4, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, user_id, email, name, role`,
      [userId, email, hashedPassword, name]
    );
    if (res.rows.length > 0) {
      console.log('✓ Admin user created:', res.rows[0].email);
    } else {
      console.log('⚠ Admin user already exists');
    }
  } catch (err) {
    if (err.code === '23505') {
      console.log('⚠ Admin user already exists');
    } else {
      throw err;
    }
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

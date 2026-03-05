#!/usr/bin/env node
/**
 * Run database migrations
 * Usage: node scripts/run-migrations.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running migration: ${file}`);
    try {
      await pool.query(sql);
      console.log(`  ✓ ${file} completed`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ⚠ ${file} - objects may already exist, skipping`);
      } else {
        console.error(`  ✗ ${file} failed:`, err.message);
        throw err;
      }
    }
  }
}

runMigrations()
  .then(() => {
    console.log('\n✓ All migrations completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n✗ Migration failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());

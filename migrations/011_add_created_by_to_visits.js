const Database = require('../src/config/database');

async function runMigration() {
  try {
    console.log('Adding created_by column to preventive_visits...');
    
    // Add created_by column if not exists
    await Database.query(`
      ALTER TABLE preventive_visits 
      ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);
    
    console.log('✅ created_by column added successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();

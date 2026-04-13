const Database = require('../src/config/database');

async function runMigration() {
  try {
    console.log('Running migration: Add preventive maintenance and user columns...');
    
    // 1. Add missing columns to users table
    console.log('Adding system_type column...');
    await Database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS system_type VARCHAR(100)`);
    
    console.log('Adding car_count column...');
    await Database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS car_count INTEGER`);
    
    console.log('Adding system_quantity column...');
    await Database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS system_quantity INTEGER`);
    
    console.log('Adding state column...');
    await Database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100)`);
    
    console.log('Adding area column...');
    await Database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS area VARCHAR(100)`);
    
    console.log('Adding area_head_id column...');
    await Database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS area_head_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    
    // 2. Update role constraint to include area_head
    console.log('Updating role constraint...');
    await Database.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await Database.query(`ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'Admin', 'engineer', 'Engineer', 'user', 'User', 'area_head', 'Area Head'))`);
    
    // 3. Create preventive_visits table
    console.log('Creating preventive_visits table...');
    await Database.query(`
      CREATE TABLE IF NOT EXISTS preventive_visits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        engineer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        visit_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'overdue')),
        notes TEXT,
        completion_notes TEXT,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 4. Create indexes
    console.log('Creating indexes...');
    await Database.query(`CREATE INDEX IF NOT EXISTS idx_preventive_visits_user_id ON preventive_visits(user_id)`);
    await Database.query(`CREATE INDEX IF NOT EXISTS idx_preventive_visits_engineer_id ON preventive_visits(engineer_id)`);
    await Database.query(`CREATE INDEX IF NOT EXISTS idx_preventive_visits_visit_date ON preventive_visits(visit_date)`);
    await Database.query(`CREATE INDEX IF NOT EXISTS idx_preventive_visits_status ON preventive_visits(status)`);
    
    // 5. Add trigger for updated_at
    console.log('Creating trigger function...');
    await Database.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    
    console.log('Creating trigger for preventive_visits...');
    await Database.query(`
      DROP TRIGGER IF EXISTS update_preventive_visits_updated_at ON preventive_visits
    `);
    await Database.query(`
      CREATE TRIGGER update_preventive_visits_updated_at
      BEFORE UPDATE ON preventive_visits
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()
    `);
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();

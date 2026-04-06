const Database = require('../src/config/database');

async function runMigration() {
  try {
    console.log('Running migration to add completed status...');
    
    // Drop existing constraint
    await Database.query('ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check');
    console.log('Dropped existing constraint');
    
    // Add new constraint with completed status
    await Database.query(`ALTER TABLE tickets ADD CONSTRAINT tickets_status_check 
      CHECK (status IN ('open', 'in-progress', 'completed', 'resolved', 'closed'))`);
    console.log('Added new constraint with completed status');
    
    // Add comment
    await Database.query("COMMENT ON COLUMN tickets.status IS 'Ticket status: open, in-progress, completed, resolved, or closed'");
    console.log('Added column comment');
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('Constraint might not exist, continuing...');
    } else {
      process.exit(1);
    }
  }
}

runMigration();

const { Pool } = require('pg');

// Database connection string from user
const DATABASE_URL = 'postgresql://neondb_owner:npg_FIToh7Neqj2L@ep-jolly-sound-aixwktp2-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function resetTickets() {
  try {
    console.log('Connecting to Neon PostgreSQL database...');
    const client = await pool.connect();
    console.log('✓ Connected to database\n');

    // Check current ticket count
    const countResult = await client.query('SELECT COUNT(*) as count FROM tickets');
    const currentCount = countResult.rows[0].count;
    console.log(`Current tickets in database: ${currentCount}`);

    if (currentCount === '0') {
      console.log('No tickets to delete. Checking if sequence needs reset...\n');
    } else {
      console.log(`Deleting ${currentCount} tickets...\n`);
    }

    // Truncate table and restart identity (resets the id sequence to 1)
    await client.query('TRUNCATE TABLE tickets RESTART IDENTITY CASCADE');
    console.log('✓ All tickets deleted');
    console.log('✓ Ticket ID sequence reset to 1');

    // Verify reset
    const verifyResult = await client.query('SELECT COUNT(*) as count FROM tickets');
    console.log(`\nVerification - Tickets count after reset: ${verifyResult.rows[0].count}`);

    // Check current sequence value
    const seqResult = await client.query("SELECT last_value FROM tickets_id_seq");
    console.log(`Next ticket ID will be: ${seqResult.rows[0].last_value}`);

    client.release();
    console.log('\n✓ Ticket reset completed successfully!');
    console.log('The next ticket created will have id = 1');

  } catch (error) {
    console.error('\n✗ Error resetting tickets:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetTickets();

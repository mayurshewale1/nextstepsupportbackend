-- ============================================================
-- Reset All Tickets - Delete all records and reset ID to 1
-- Run this in your Neon Database SQL Editor
-- ============================================================

-- Option 1: TRUNCATE with RESTART IDENTITY (fastest, preferred)
-- This deletes all rows and resets the sequence atomically
TRUNCATE TABLE tickets RESTART IDENTITY CASCADE;

-- Option 2: If you have foreign key constraints or need more control
-- DELETE FROM tickets;
-- ALTER SEQUENCE tickets_id_seq RESTART WITH 1;

-- Verify the reset
SELECT 'Tickets count after reset: ' || COUNT(*) as status FROM tickets;

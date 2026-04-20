-- Add system_type column to tickets table
-- This allows complaints to be filed for specific parking systems

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS system_type VARCHAR(100);

-- Add index for better performance when filtering by system type
CREATE INDEX IF NOT EXISTS idx_tickets_system_type ON tickets(system_type);

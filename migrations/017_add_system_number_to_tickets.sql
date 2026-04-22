-- Add system_number column to tickets table
-- This allows complaints to specify which system number (1, 2, 3, etc.) has the problem

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS system_number VARCHAR(10);

-- Add index for better performance when filtering by system number
CREATE INDEX IF NOT EXISTS idx_tickets_system_number ON tickets(system_number);

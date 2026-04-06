-- Add 'completed' status to tickets table check constraint
-- This migration allows engineers to set ticket status to 'completed'

-- First, drop the existing check constraint
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;

-- Add a new check constraint that includes 'completed'
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check 
  CHECK (status IN ('open', 'in-progress', 'completed', 'resolved', 'closed'));

-- Add comment for documentation
COMMENT ON COLUMN tickets.status IS 'Ticket status: open, in-progress, completed, resolved, or closed';

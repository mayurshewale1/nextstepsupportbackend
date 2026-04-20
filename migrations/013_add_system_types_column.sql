-- Add system_types column to store multiple systems as JSON array
-- This allows users to have multiple parking systems assigned

-- Add the new column as JSONB to store array of system types
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_types JSONB DEFAULT NULL;

-- Add index for better performance when querying
CREATE INDEX IF NOT EXISTS idx_users_system_types ON users USING GIN (system_types);

-- Note: The old system_type column is kept for backward compatibility
-- but system_types (plural) will be used going forward

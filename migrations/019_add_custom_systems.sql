-- Add custom_systems column to store user-defined systems with quantities
-- This allows users to add systems not in the predefined list

-- Add the new column as JSONB to store array of custom systems
-- Format: [{"name": "Custom System", "quantity": 3}, ...]
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_systems JSONB DEFAULT NULL;

-- Add index for better performance when querying
CREATE INDEX IF NOT EXISTS idx_users_custom_systems ON users USING GIN (custom_systems);

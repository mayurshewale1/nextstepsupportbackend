-- Add system_type_quantities column to store counts for each system type
-- This allows storing quantity/count for each selected system type

-- Add the new column as JSONB to store quantities object
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_type_quantities JSONB DEFAULT NULL;

-- Add index for better performance when querying
CREATE INDEX IF NOT EXISTS idx_users_system_type_quantities ON users USING GIN (system_type_quantities);

-- Note: This stores quantities as a JSON object like:
-- {"Hydraulic Stack": 2, "3LD": 5}
-- where keys are system type names and values are quantities

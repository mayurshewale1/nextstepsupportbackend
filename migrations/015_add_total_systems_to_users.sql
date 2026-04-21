-- Add total_systems column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_systems INTEGER DEFAULT NULL;

-- Add comment to describe the column
COMMENT ON COLUMN users.total_systems IS 'Total number of systems installed at user site';

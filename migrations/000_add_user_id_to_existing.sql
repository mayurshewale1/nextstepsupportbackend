-- Add user_id column to existing users table (if missing)
-- Runs before 001 so index creation succeeds
-- Safe to run - only adds column if missing

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_id')
  THEN
    ALTER TABLE users ADD COLUMN user_id VARCHAR(100) UNIQUE;
    UPDATE users SET user_id = 'user_' || id::text WHERE user_id IS NULL;
    ALTER TABLE users ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

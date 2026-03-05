-- Add user_id column if upgrading from old schema (users table without user_id)
-- Safe to run - only adds column if missing

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE users ADD COLUMN user_id VARCHAR(100) UNIQUE;
    UPDATE users SET user_id = 'user_' || id::text WHERE user_id IS NULL;
    ALTER TABLE users ALTER COLUMN user_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(32),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_tokens_user_id ON notification_tokens(user_id);

DROP TRIGGER IF EXISTS update_notification_tokens_updated_at ON notification_tokens;
CREATE TRIGGER update_notification_tokens_updated_at
  BEFORE UPDATE ON notification_tokens
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

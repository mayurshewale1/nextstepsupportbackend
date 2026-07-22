-- Builder/Developer project fields (optional)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_builder_developer BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_id VARCHAR(100) DEFAULT NULL;

-- Per-system handover dates: [{"systemType":"Hydraulic Stack","handoverDate":"2024-01-15"}, ...]
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_handover_dates JSONB DEFAULT NULL;

-- Contract end / renewal date for DLP / AMC / CMC 8-day reminders
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_end_date DATE DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_reminder_sent_at TIMESTAMP DEFAULT NULL;

-- Engineer form photo on ticket feedback
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS feedback_image_path VARCHAR(500) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_contract_end_date ON users (contract_end_date)
  WHERE contract_end_date IS NOT NULL;

-- Migration: Add preventive maintenance and user columns
-- Run with: psql -d your_database -f 010_add_preventive_maintenance.sql

-- 1. Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_type VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_count INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_quantity INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS area VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS area_head_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 2. Update role constraint to include area_head
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'Admin', 'engineer', 'Engineer', 'user', 'User', 'area_head', 'Area Head'));

-- 3. Create preventive_visits table
CREATE TABLE IF NOT EXISTS preventive_visits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  engineer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'overdue')),
  notes TEXT,
  completion_notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_preventive_visits_user_id ON preventive_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_preventive_visits_engineer_id ON preventive_visits(engineer_id);
CREATE INDEX IF NOT EXISTS idx_preventive_visits_visit_date ON preventive_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_preventive_visits_status ON preventive_visits(status);

-- 5. Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_preventive_visits_updated_at ON preventive_visits;
CREATE TRIGGER update_preventive_visits_updated_at
  BEFORE UPDATE ON preventive_visits
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Migration complete

-- ============================================================
-- NextStep Backend - Complete Schema for Neon Database
-- Run this in Neon SQL Editor: https://console.neon.tech
-- ============================================================

-- 1. Add missing columns to existing users table (if upgrading from old schema)
DO $$
BEGIN
  -- Add user_id if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_id')
  THEN
    ALTER TABLE users ADD COLUMN user_id VARCHAR(100) UNIQUE;
    UPDATE users SET user_id = 'user_' || id::text WHERE user_id IS NULL;
    ALTER TABLE users ALTER COLUMN user_id SET NOT NULL;
  END IF;

  -- Add phone if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone')
  THEN
    ALTER TABLE users ADD COLUMN phone VARCHAR(50);
  END IF;

  -- Add avatar_url if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_url')
  THEN
    ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
  END IF;

  -- Add is_active if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active')
  THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  -- Add created_at if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at')
  THEN
    ALTER TABLE users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- Add updated_at if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at')
  THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- Add system_type if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'system_type')
  THEN
    ALTER TABLE users ADD COLUMN system_type VARCHAR(100);
  END IF;

  -- Add car_count if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'car_count')
  THEN
    ALTER TABLE users ADD COLUMN car_count INTEGER;
  END IF;

  -- Add system_quantity if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'system_quantity')
  THEN
    ALTER TABLE users ADD COLUMN system_quantity INTEGER;
  END IF;

  -- Add state if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'state')
  THEN
    ALTER TABLE users ADD COLUMN state VARCHAR(100);
  END IF;

  -- Add area (district) if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'area')
  THEN
    ALTER TABLE users ADD COLUMN area VARCHAR(100);
  END IF;

  -- Add area_head_id if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'area_head_id')
  THEN
    ALTER TABLE users ADD COLUMN area_head_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'Admin', 'engineer', 'Engineer', 'user', 'User', 'area_head', 'Area Head')),
  phone VARCHAR(50),
  avatar_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  site_name VARCHAR(255),
  site_address TEXT,
  site_type VARCHAR(50),
  system_type VARCHAR(100),
  car_count INTEGER,
  system_quantity INTEGER,
  state VARCHAR(100),
  area VARCHAR(100),
  area_head_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tickets table (support tickets / complaints)
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  category VARCHAR(100),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Preventive Maintenance Visits table (for AMC users)
CREATE TABLE IF NOT EXISTS preventive_visits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  engineer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'overdue')),
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_resolved_at ON tickets(resolved_at);
CREATE INDEX IF NOT EXISTS idx_preventive_visits_user_id ON preventive_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_preventive_visits_engineer_id ON preventive_visits(engineer_id);
CREATE INDEX IF NOT EXISTS idx_preventive_visits_visit_date ON preventive_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_preventive_visits_status ON preventive_visits(status);

-- 5. Trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_preventive_visits_updated_at ON preventive_visits;
CREATE TRIGGER update_preventive_visits_updated_at
  BEFORE UPDATE ON preventive_visits
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

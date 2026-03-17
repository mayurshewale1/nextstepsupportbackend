-- Add site columns for user/site management (Company → Site)
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_type VARCHAR(100);

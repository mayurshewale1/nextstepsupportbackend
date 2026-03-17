-- Add latitude/longitude for location-based engineer assignment
-- Users (engineers): their base/current location
-- Tickets: complaint location when user raises it

-- Add location columns to users (for engineers)
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add location columns to tickets (complaint location)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

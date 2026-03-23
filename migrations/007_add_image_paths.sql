-- Add image_paths for multiple images per ticket (JSON array of paths)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS image_paths TEXT;

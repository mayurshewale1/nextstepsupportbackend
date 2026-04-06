-- Add support for multiple images per ticket
-- This migration adds a new column to store JSON array of image paths
-- while keeping the existing image_path column for backward compatibility

-- Add new column for multiple images (JSONB array for better performance)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS image_paths JSONB;

-- Migrate existing single image_path to image_paths if it exists
UPDATE tickets 
SET image_paths = TO_JSONB(ARRAY[image_path]) 
WHERE image_path IS NOT NULL 
  AND image_path != '' 
  AND image_paths IS NULL;

-- Note: Index can be added later if needed for performance optimization
-- CREATE INDEX IF NOT EXISTS idx_tickets_image_paths ON tickets USING GIN(image_paths);

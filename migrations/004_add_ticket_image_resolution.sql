-- Add resolution and image_path to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS image_path VARCHAR(500);

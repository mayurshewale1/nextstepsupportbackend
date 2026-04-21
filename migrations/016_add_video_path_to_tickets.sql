-- Add video_path column to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS video_path VARCHAR(255) DEFAULT NULL;

-- Add comment to describe the column
COMMENT ON COLUMN tickets.video_path IS 'Path to uploaded video file (max 25MB)';

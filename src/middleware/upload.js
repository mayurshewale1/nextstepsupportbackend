const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp'];
    const safeExt = allowedExts.includes(ext) ? ext : '.jpg';
    cb(null, `ticket-${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedImages = /\.(jpg|jpeg|png|gif|webp)$/i;
  const allowedVideos = /\.(mp4|mov|avi|mkv|webm|3gp)$/i;
  if (allowedImages.test(file.originalname) || allowedVideos.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, gif, webp) and video files (mp4, mov, avi, webm, 3gp) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB per file for videos
    files: 5 // Maximum 5 files per request
  },
});

module.exports = upload;

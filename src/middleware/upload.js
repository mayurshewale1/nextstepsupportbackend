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
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const safeExt = [...imageExts, ...videoExts].includes(ext) ? ext : '.jpg';
    cb(null, `ticket-${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const imageAllowed = /\.(jpg|jpeg|png|gif|webp)$/i;
  const videoAllowed = /\.(mp4|mov|avi|mkv|webm)$/i;
  
  if (imageAllowed.test(file.originalname) || videoAllowed.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, gif, webp) and video files (mp4, mov, avi, mkv, webm) are allowed'), false);
  }
};

// Configure multer with dynamic file size limits
const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 30 * 1024 * 1024, // 30MB max to accommodate 25MB videos + margin
    files: 6 // 5 images + 1 video maximum per request
  },
});

module.exports = upload;

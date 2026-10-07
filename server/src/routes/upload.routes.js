const { Router } = require('express');
const multer = require('multer');
const { uploadSingle, uploadMultiple } = require('../controllers/upload.controller');
const { protect } = require('../middlewares/auth');

const router = Router();

// Store files in memory so storageService can stream to Firebase Storage or save to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, GIF, MP4, WEBM`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size (supports product video clips)
  },
  fileFilter,
});

// Single file upload: accept 'file' or 'image' field
router.post('/', upload.single('file'), uploadSingle);
router.post('/single', upload.single('image'), uploadSingle);

// Multiple files upload (up to 10): accept 'files' or 'images'
router.post('/multiple', upload.array('files', 10), uploadMultiple);

module.exports = router;

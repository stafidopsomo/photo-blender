const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

/**
 * Configures multer for secure file uploads
 * @param {string} uploadsDir - Directory path for file uploads
 * @returns {Object} Configured multer instance
 */
function configureMulter(uploadsDir) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      // Use cryptographically secure random bytes for unpredictable file names
      const randomBytes = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      cb(null, `${timestamp}-${randomBytes}${path.extname(file.originalname)}`);
    }
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    }
  });

  return upload;
}

module.exports = { configureMulter };

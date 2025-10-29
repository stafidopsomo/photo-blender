const cloudinary = require('cloudinary').v2;
require('dotenv').config();

/**
 * Validates and configures Cloudinary
 * Fails fast in production if credentials are not properly configured
 */
function configureCloudinary() {
  // Fail fast in production if credentials are not properly configured
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'demo') {
      console.error('ERROR: CLOUDINARY_CLOUD_NAME not configured in production!');
      process.exit(1);
    }
    if (!process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY === 'demo') {
      console.error('ERROR: CLOUDINARY_API_KEY not configured in production!');
      process.exit(1);
    }
    if (!process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET === 'demo') {
      console.error('ERROR: CLOUDINARY_API_SECRET not configured in production!');
      process.exit(1);
    }
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
    api_key: process.env.CLOUDINARY_API_KEY || 'demo',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'demo'
  });
}

module.exports = {
  configureCloudinary,
  cloudinary
};

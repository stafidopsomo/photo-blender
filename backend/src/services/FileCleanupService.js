const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

/**
 * FileCleanupService handles deletion of local and cloud-stored photos
 * Prevents resource leaks by cleaning up orphaned files
 */
class FileCleanupService {
  constructor(uploadsDir, gameRooms) {
    this.uploadsDir = uploadsDir;
    this.gameRooms = gameRooms;
  }

  // Extract Cloudinary public ID from URL
  extractCloudinaryPublicId(url) {
    try {
      // Cloudinary URLs format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{format}
      const match = url.match(/\/photo-blender\/([^/.]+)/);
      if (match) {
        return `photo-blender/${match[1]}`;
      }
      return null;
    } catch (err) {
      console.error('Error extracting Cloudinary public ID:', err);
      return null;
    }
  }

  // Delete a single local file
  async deleteLocalFile(filePath) {
    try {
      const fullPath = path.join(__dirname, '../../', filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Deleted local file: ${filePath}`);
        return true;
      }
    } catch (err) {
      console.error(`Failed to delete local file ${filePath}:`, err);
      return false;
    }
  }

  // Delete a single Cloudinary file
  async deleteCloudinaryFile(url) {
    try {
      // Skip if not a Cloudinary URL
      if (!url.includes('cloudinary.com')) {
        return false;
      }

      const publicId = this.extractCloudinaryPublicId(url);
      if (!publicId) {
        console.error('Could not extract public ID from:', url);
        return false;
      }

      // Only delete if Cloudinary is properly configured
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'demo') {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Deleted Cloudinary file: ${publicId}`);
        return true;
      }
    } catch (err) {
      console.error(`Failed to delete Cloudinary file ${url}:`, err);
      return false;
    }
  }

  // Clean up all photos for a game room
  async cleanupGamePhotos(gameRoom) {
    if (!gameRoom || !gameRoom.photos) {
      return;
    }

    console.log(`Cleaning up ${gameRoom.photos.length} photos for room ${gameRoom.roomCode}`);

    let deletedLocal = 0;
    let deletedCloudinary = 0;

    for (const photo of gameRoom.photos) {
      const photoPath = photo.path;

      // Delete from Cloudinary if it's a Cloudinary URL
      if (photoPath.includes('cloudinary.com')) {
        const deleted = await this.deleteCloudinaryFile(photoPath);
        if (deleted) deletedCloudinary++;
      }
      // Delete local file if it's a local path
      else if (photoPath.startsWith('/uploads/')) {
        const deleted = await this.deleteLocalFile(photoPath);
        if (deleted) deletedLocal++;
      }
    }

    console.log(`Cleanup complete for room ${gameRoom.roomCode}: ${deletedLocal} local, ${deletedCloudinary} Cloudinary`);
  }

  // Clean up orphaned files (files not associated with any active room)
  async cleanupOrphanedFiles() {
    try {
      console.log('Starting orphaned file cleanup...');

      // Get all active photo paths from active rooms
      const activePhotoPaths = new Set();
      for (const [roomCode, gameRoom] of this.gameRooms.entries()) {
        if (gameRoom.photos) {
          gameRoom.photos.forEach(photo => {
            activePhotoPaths.add(photo.path);
          });
        }
      }

      // Clean up local uploads directory
      const uploadFiles = fs.readdirSync(this.uploadsDir);
      let orphanedLocal = 0;

      for (const file of uploadFiles) {
        const filePath = `/uploads/${file}`;
        if (!activePhotoPaths.has(filePath)) {
          await this.deleteLocalFile(filePath);
          orphanedLocal++;
        }
      }

      console.log(`Orphaned file cleanup complete: ${orphanedLocal} local files removed`);
    } catch (err) {
      console.error('Error during orphaned file cleanup:', err);
    }
  }
}

module.exports = FileCleanupService;

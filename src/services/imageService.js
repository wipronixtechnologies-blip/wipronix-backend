const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { uploadBuffer, deleteFile } = require('./cloudinaryService');

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Storage folders
const STORAGE_FOLDERS = {
  PROFILE_PICTURES: 'profile-pictures',
  IMAGES: 'images'
};

class ImageService {
  /**
   * Validate image file
   * @param {Object} file - File object from multer
   * @returns {Object} Validation result
   */
  validateImage(file) {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return { 
        isValid: false, 
        error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}` 
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { 
        isValid: false, 
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
      };
    }

    return { isValid: true };
  }

  /**
   * Generate unique filename
   * @param {string} originalName - Original filename
   * @returns {string} Unique filename
   */
  generateFileName(originalName) {
    const ext = path.extname(originalName);
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    return `${uniqueId}-${timestamp}${ext}`;
  }

  /**
   * Upload image to Cloudinary Storage
   * @param {Object} file - File object from multer
   * @param {string} folder - Folder path in Cloudinary (profile-pictures or images)
   * @returns {Object} Upload result
   */
  async uploadImage(file, folder = STORAGE_FOLDERS.IMAGES) {
    try {
      // Validate file
      const validation = this.validateImage(file);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Upload to Cloudinary
      const result = await uploadBuffer(file.buffer, {
        folder: `wipronix/${folder}`,
        resource_type: 'image'
      });

      return {
        success: true,
        data: {
          fileName: result.public_id,
          filePath: result.public_id,
          fileUrl: result.secure_url,
          url: result.secure_url,
          public_id: result.public_id,
          size: file.size,
          contentType: file.mimetype,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Cloudinary image upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload image to Cloudinary'
      };
    }
  }

  /**
   * Delete image from Firebase Storage
   * @param {string} filePath - Path of file in storage
   * @returns {Object} Deletion result
   */
  async deleteImage(filePath) {
    try {
      const fileToDelete = bucket.file(filePath);
      
      // Check if file exists
      const [exists] = await fileToDelete.exists();
      if (!exists) {
        return {
          success: true,
          message: 'Image file not found (already deleted)'
        };
      }

      // Delete the file
      await fileToDelete.delete();
      return {
        success: true,
        message: 'Image deleted successfully'
      };

    } catch (error) {
      console.error('Image deletion error:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete image'
      };
    }
  }

  /**
   * Get image metadata from Firebase Storage
   * @param {string} filePath - Path of file in storage
   * @returns {Object} File metadata
   */
  async getImageMetadata(filePath) {
    try {
      const file = bucket.file(filePath);
      
      const [metadata] = await file.getMetadata();
      
      return {
        success: true,
        data: {
          name: path.basename(filePath),
          size: parseInt(metadata.size),
          contentType: metadata.contentType,
          created: metadata.timeCreated,
          updated: metadata.updated,
          bucket: metadata.bucket,
          storageClass: metadata.storageClass
        }
      };
    } catch (error) {
      console.error('Get metadata error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get image metadata'
      };
    }
  }

  /**
   * Check if file exists in Firebase Storage
   * @param {string} filePath - Path of file in storage
   * @returns {boolean} File exists
   */
  async fileExists(filePath) {
    try {
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error('File exists check error:', error);
      return false;
    }
  }

  /**
   * Get a signed URL for temporary access to a file
   * @param {string} filePath - Path of file in storage
   * @param {number} expiresIn - Expiration time in milliseconds (default: 1 hour)
   * @returns {Object} Signed URL result
   */
  async getSignedUrl(filePath, expiresIn = 60 * 60 * 1000) {
    try {
      const file = bucket.file(filePath);
      
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresIn
      });

      return {
        success: true,
        data: {
          url: signedUrl,
          expiresIn: expiresIn
        }
      };
    } catch (error) {
      console.error('Get signed URL error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get signed URL'
      };
    }
  }

  /**
   * Upload multiple images
   * @param {Array} files - Array of file objects from multer
   * @param {string} folder - Folder path in storage
   * @returns {Object} Upload results
   */
  async uploadMultipleImages(files, folder = STORAGE_FOLDERS.IMAGES) {
    try {
      const results = await Promise.all(
        files.map(file => this.uploadImage(file, folder))
      );
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      return {
        success: true,
        data: {
          total: files.length,
          successful: successful.length,
          failed: failed.length,
          results: results
        }
      };
    } catch (error) {
      console.error('Multiple image upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload images'
      };
    }
  }
}

module.exports = new ImageService();


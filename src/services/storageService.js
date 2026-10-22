const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { uploadBuffer, deleteFile } = require('./cloudinaryService');

// Allowed MIME types
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

// Maximum file size (15MB)
const MAX_FILE_SIZE = 15 * 1024 * 1024;

class StorageService {
  /**
   * Validate file
   * @param {Object} file - File object from multer
   * @returns {Object} Validation result
   */
  validateFile(file) {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return { 
        isValid: false, 
        error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}` 
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
   * Upload file to Cloudinary Storage
   * @param {Object} file - File object from multer
   * @param {string} folder - Folder path in storage
   * @returns {Object} Upload result
   */
  async uploadFile(file, folder = 'documents') {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Upload to Cloudinary with auto resource type (supports pdf, docx, images)
      const result = await uploadBuffer(file.buffer, {
        folder: `wipronix/${folder}`,
        resource_type: 'auto'
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
      console.error('Cloudinary document upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload document to Cloudinary'
      };
    }
  }

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(publicId) {
    try {
      if (!publicId) return { success: true };
      await deleteFile(publicId);
      return { success: true };
    } catch (error) {
      console.error('Cloudinary file deletion error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new StorageService();

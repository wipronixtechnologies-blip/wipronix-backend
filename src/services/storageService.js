const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { bucket } = require('../config/firebase');

// Allowed MIME types
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
   * Upload file to Firebase Storage
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

      // Generate unique filename
      const fileName = this.generateFileName(file.originalname);
      const filePath = `${folder}/${fileName}`;
      
      // Create file reference in Firebase Storage
      const fileUpload = bucket.file(filePath);

      // Upload file to Firebase Storage
      await fileUpload.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            firebaseStorageDownloadTokens: uuidv4()
          }
        }
      });

      // Get signed URL for the file (valid for 1 year)
      const [signedUrl] = await fileUpload.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
      });

      return {
        success: true,
        data: {
          fileName,
          filePath: filePath,
          fileUrl: signedUrl,
          size: file.size,
          contentType: file.mimetype,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload file'
      };
    }
  }

  /**
   * Delete file from Firebase Storage
   */
  async deleteFile(filePath) {
    try {
      const fileToDelete = bucket.file(filePath);
      const [exists] = await fileToDelete.exists();
      if (!exists) return { success: true };
      
      await fileToDelete.delete();
      return { success: true };
    } catch (error) {
      console.error('File deletion error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new StorageService();

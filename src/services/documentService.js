const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { bucket } = require('../config/firebase');

// Allowed document MIME types
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Storage folders
const STORAGE_FOLDERS = {
  RESIGNATIONS: 'resignation-letters',
  DOCUMENTS: 'documents'
};

class DocumentService {
  validateDocument(file) {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    if (!ALLOWED_DOC_TYPES.includes(file.mimetype)) {
      return { 
        isValid: false, 
        error: `Invalid file type. Allowed types: PDF, DOC, DOCX` 
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

  generateFileName(originalName) {
    const ext = path.extname(originalName);
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    return `${uniqueId}-${timestamp}${ext}`;
  }

  async uploadDocument(file, folder = STORAGE_FOLDERS.DOCUMENTS) {
    try {
      const validation = this.validateDocument(file);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      const fileName = this.generateFileName(file.originalname);
      const filePath = `${folder}/${fileName}`;
      
      const fileUpload = bucket.file(filePath);

      await fileUpload.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            firebaseStorageDownloadTokens: uuidv4()
          }
        }
      });

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
          contentType: file.mimetype,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Document upload error:', error);
      return { success: false, error: error.message || 'Failed to upload document' };
    }
  }
}

module.exports = new DocumentService();

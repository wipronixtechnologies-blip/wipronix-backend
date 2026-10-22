const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { uploadBuffer, deleteFile } = require('./cloudinaryService');

// Allowed document MIME types
const ALLOWED_DOC_TYPES = [
  'application/pdf', 
  'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
];

// Maximum file size (15MB)
const MAX_FILE_SIZE = 15 * 1024 * 1024;

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
        error: `Invalid file type. Allowed types: PDF, DOC, DOCX, JPEG, PNG` 
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
          contentType: file.mimetype,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Cloudinary document upload error:', error);
      return { success: false, error: error.message || 'Failed to upload document to Cloudinary' };
    }
  }

  async deleteDocument(publicId) {
    try {
      if (!publicId) return { success: true };
      await deleteFile(publicId);
      return { success: true };
    } catch (error) {
      console.error('Cloudinary document deletion error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new DocumentService();

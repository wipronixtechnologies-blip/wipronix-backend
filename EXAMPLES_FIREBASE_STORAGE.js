/**
 * Firebase Storage Integration Examples
 * 
 * This file demonstrates how to use the Firebase Storage service
 * for uploading, deleting, and managing images.
 */

const express = require('express');
const multer = require('multer');
const imageService = require('./src/services/imageService');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'), false);
    }
  }
});

const router = express.Router();

/**
 * POST /api/images/upload
 * Upload a single image to Firebase Storage
 * 
 * Request: multipart/form-data with 'image' field
 * Body: (optional) folder - 'profile-pictures' or 'images'
 */
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Get folder from request body, default to 'images'
    const folder = req.body.folder || 'images';

    // Validate folder
    if (!['profile-pictures', 'images'].includes(folder)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid folder. Use "profile-pictures" or "images"'
      });
    }

    // Upload to Firebase Storage
    const result = await imageService.uploadImage(req.file, folder);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          fileName: result.data.fileName,
          filePath: result.data.filePath,
          fileUrl: result.data.fileUrl, // Signed URL (valid 1 year)
          size: result.data.size,
          contentType: result.data.contentType,
          uploadedAt: result.data.uploadedAt
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to upload image',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/images/upload-multiple
 * Upload multiple images to Firebase Storage
 * 
 * Request: multipart/form-data with 'images' field (array)
 */
router.post('/upload-multiple', upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided'
      });
    }

    const folder = req.body.folder || 'images';
    const result = await imageService.uploadMultipleImages(req.files, folder);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: `Uploaded ${result.data.successful} of ${result.data.total} images`,
        data: {
          total: result.data.total,
          successful: result.data.successful,
          failed: result.data.failed,
          results: result.data.results.map(r => ({
            success: r.success,
            fileName: r.data?.fileName,
            fileUrl: r.data?.fileUrl,
            error: r.error
          }))
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to upload images',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/images/:filePath
 * Delete an image from Firebase Storage
 * 
 * URL parameter: filePath - The path of the file to delete
 * Example: /api/images/profile-pictures/uuid-timestamp.jpg
 */
router.delete('/:filePath(*)', async (req, res) => {
  try {
    const { filePath } = req.params;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    // Decode URI component to handle special characters
    const decodedPath = decodeURIComponent(filePath);
    const result = await imageService.deleteImage(decodedPath);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error || 'Failed to delete image'
      });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/images/metadata/:filePath
 * Get metadata for an image in Firebase Storage
 */
router.get('/metadata/:filePath(*)', async (req, res) => {
  try {
    const { filePath } = req.params;
    const decodedPath = decodeURIComponent(filePath);

    const result = await imageService.getImageMetadata(decodedPath);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/images/signed-url/:filePath
 * Get a temporary signed URL for accessing an image
 * 
 * Query params: expiresIn (optional) - URL validity in milliseconds
 */
router.get('/signed-url/:filePath(*)', async (req, res) => {
  try {
    const { filePath } = req.params;
    const expiresIn = parseInt(req.query.expiresIn) || 3600000; // Default 1 hour

    const decodedPath = decodeURIComponent(filePath);
    const result = await imageService.getSignedUrl(decodedPath, expiresIn);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: {
          url: result.data.url,
          expiresIn: result.data.expiresIn
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Signed URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/images/check/:filePath
 * Check if an image exists in Firebase Storage
 */
router.get('/check/:filePath(*)', async (req, res) => {
  try {
    const { filePath } = req.params;
    const decodedPath = decodeURIComponent(filePath);

    const exists = await imageService.fileExists(decodedPath);

    res.status(200).json({
      success: true,
      data: {
        filePath: decodedPath,
        exists: exists
      }
    });
  } catch (error) {
    console.error('Check exists error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;


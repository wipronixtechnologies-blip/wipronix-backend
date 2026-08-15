
const multer = require('multer');
const imageService = require('../../src/services/imageService');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'), false);
    }
  }
});

/**
 * Helper function to handle errors consistently
 */
const handleError = (error, response, operation) => {
  // Handle multer errors
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return response.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
  }

  // Handle custom file filter errors
  if (error.message && error.message.includes('Invalid file type')) {
    return response.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error(`${operation} error:`, error);
  return response.status(500).json({
    success: false,
    message: `Internal server error during ${operation}`,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

const uploadImage = async (request, response, next) => {
  try {
    // Check if file was uploaded
    if (!request.file) {
      return response.status(400).json({
        success: false,
        message: 'No image file provided. Please upload an image file.'
      });
    }

    // Get folder from request body or use default
    const folder = request.body.folder || 'images';

    // Upload image using the service
    const uploadResult = await imageService.uploadImage(request.file, folder);

    if (!uploadResult.success) {
      return response.status(400).json({
        success: false,
        message: uploadResult.error
      });
    }

    // Return success response
    response.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: uploadResult.data
    });

  } catch (error) {
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return response.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 5MB.'
        });
      }
    }

    // Handle custom file filter errors
    if (error.message && error.message.includes('Invalid file type')) {
      return response.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error("Image upload error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error during image upload",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deleteImage = async (request, response, next) => {
  try {
    const { filePath } = request.params;

    if (!filePath) {
      return response.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    // Delete image using the service
    const deleteResult = await imageService.deleteImage(filePath);

    if (!deleteResult.success) {
      return response.status(400).json({
        success: false,
        message: deleteResult.error
      });
    }

    // Return success response
    response.status(200).json({
      success: true,
      message: deleteResult.message
    });

  } catch (error) {
    console.error("Image deletion error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error during image deletion",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getImageMetadata = async (request, response, next) => {
  try {
    const { filePath } = request.params;

    if (!filePath) {
      return response.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    // Get image metadata using the service
    const metadataResult = await imageService.getImageMetadata(filePath);

    if (!metadataResult.success) {
      return response.status(400).json({
        success: false,
        message: metadataResult.error
      });
    }

    // Return success response
    response.status(200).json({
      success: true,
      message: 'Image metadata retrieved successfully',
      data: metadataResult.data
    });

  } catch (error) {
    console.error("Get image metadata error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error while retrieving image metadata",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Export multer middleware and controllers
module.exports = {
  upload: upload.single('image'), // Middleware for single image upload
  uploadImage,
  deleteImage,
  getImageMetadata
};


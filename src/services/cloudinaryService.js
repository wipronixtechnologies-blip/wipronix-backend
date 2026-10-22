const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

/**
 * Upload buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from multer
 * @param {Object} options - Options including folder, filename, resource_type
 * @returns {Promise<Object>} Upload result from Cloudinary
 */
const uploadBuffer = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: options.folder || 'wipronix-media',
      resource_type: options.resource_type || 'auto',
      use_filename: true,
      unique_filename: true,
      ...options
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        console.error('Cloudinary stream upload error:', error);
        return reject(error);
      }
      resolve(result);
    });

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
};

/**
 * Upload base64 or file path to Cloudinary
 * @param {string} fileStr - Data URI or file path
 * @param {Object} options - Options including folder, resource_type
 * @returns {Promise<Object>} Upload result from Cloudinary
 */
const uploadBase64 = async (fileStr, options = {}) => {
  return cloudinary.uploader.upload(fileStr, {
    folder: options.folder || 'wipronix-media',
    resource_type: options.resource_type || 'auto',
    ...options
  });
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Options
 */
const deleteFile = async (publicId, options = {}) => {
  return cloudinary.uploader.destroy(publicId, options);
};

module.exports = {
  uploadBuffer,
  uploadBase64,
  deleteFile,
  cloudinary
};

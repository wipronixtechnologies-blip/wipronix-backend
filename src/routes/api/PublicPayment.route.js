const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const publicPaymentController = require('../../../controllers/Public/publicPaymentController');

// Multer memory storage configuration (Max 5MB, strict MIME check)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and PDF files are allowed.'), false);
    }
  }
});

// Middleware for handling multer upload errors gracefully
const handleUpload = (req, res, next) => {
  upload.single('screenshot')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds maximum allowed limit of 5MB.'
        });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// Rate limiter for viewing payment portal details (max 60 calls per 15 minutes per IP)
const getPortalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again after a few minutes.'
  }
});

// Rate limiter for submitting payment proof (max 8 submissions per 15 minutes per IP)
const submitProofLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many submissions from your connection. Please wait 15 minutes before retrying.'
  }
});

// Public Routes
router.get('/registration-pay/:token', getPortalLimiter, publicPaymentController.getPaymentPortalData);
router.post('/registration-pay/:token/submit', submitProofLimiter, handleUpload, publicPaymentController.submitPaymentProof);
router.get('/receipt-details/:registrationNo', publicPaymentController.getPublicReceiptDetails);
router.get('/receipt/:registrationNo', publicPaymentController.downloadPublicReceiptPdf);
router.get('/receipt-pdf/:registrationNo', publicPaymentController.downloadPublicReceiptPdf);

module.exports = router;

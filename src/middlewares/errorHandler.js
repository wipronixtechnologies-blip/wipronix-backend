const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
  
  // Note: CORS headers are handled by the main cors middleware in app.js
  // Do not set them here to avoid conflicts
  
  res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  };
  
  module.exports = errorHandler;
  
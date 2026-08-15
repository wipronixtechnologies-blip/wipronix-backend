const jwt = require('jsonwebtoken');
const Student = require('../../models/Student.model');

const authenticate = async (request, response, next) => {
  try {
    // Get token from cookies or Authorization header
    const token = request.cookies.token || 
                  (request.headers.authorization && request.headers.authorization.startsWith('Bearer ') 
                    ? request.headers.authorization.slice(7) 
                    : null);

    if (!token) {
      return response.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get student from database
    const student = await Student.findById(decoded.studentId).select('-password');
    
    if (!student) {
      return response.status(401).json({
        success: false,
        message: 'Invalid token - student not found'
      });
    }

    // Add student to request object
    request.student = student;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Authentication error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error during authentication'
    });
  }
};

module.exports = authenticate;


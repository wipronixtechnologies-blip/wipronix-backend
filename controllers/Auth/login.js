const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('../../models/Student.model');
const { loginSchema } = require('../../src/services/validationSchema');

const login = async (request, response, next) => {
  try {
    // Validate input using Joi
    const validatedData = await loginSchema.validateAsync(request.body);
    const { email, password } = validatedData;

    // Find student by email
    const student = await Student.findOne({ email });
    if (!student) {
      return response.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if student has a password (registered users)
    if (!student.password) {
      return response.status(401).json({
        success: false,
        message: 'Please register first to create an account'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, student.password);
    if (!isPasswordValid) {
      return response.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: student._id, email: student.email },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    // Set cookie with token
    const isProd = process.env.NODE_ENV === 'production';
    response.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    response.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: student._id,
        name: student.name,
        email: student.email
      }
    });
  } catch (error) {
    // Handle Joi validation errors
    if (error.isJoi) {
      return response.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    console.error("Login error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error during login",
    });
  }
};

module.exports = login;


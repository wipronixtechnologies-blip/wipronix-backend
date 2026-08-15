const crypto = require('crypto');
const Student = require('../../models/Student.model');
const { sendPasswordResetEmail } = require('../../src/services/emailService');
const { forgotPasswordSchema } = require('../../src/services/validationSchema');

const forgotPassword = async (request, response, next) => {
  try {
    // Validate input using Joi
    const validatedData = await forgotPasswordSchema.validateAsync(request.body);
    const { email } = validatedData;

    // Find student by email
    const student = await Student.findOne({ email: email.toLowerCase().trim() });
    if (!student) {
      // Don't reveal if email exists or not for security
      return response.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token before saving to database
    const hashedResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set token expiration (24 hours from now)
    const resetPasswordExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Save reset token and expiration to database
    await Student.findByIdAndUpdate(student._id, {
      resetPasswordToken: hashedResetToken,
      resetPasswordExpires: resetPasswordExpires
    });

    // Prepare student data for email
    const studentData = {
      fullName: student.fullName,
      email: student.email
    };

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(studentData, resetToken);
    
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      return response.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again.'
      });
    }

    // Clear any sensitive data from memory
    resetToken = null;
    hashedResetToken = null;

    response.status(200).json({
      success: true,
      message: 'Password reset link has been sent to your email address.',
      // In development, you might want to include the token for testing
      ...(process.env.NODE_ENV === 'development' && { 
        resetToken: resetToken,
        expiresIn: '24 hours'
      })
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

    console.error("Forgot password error:", error);
    
    // Clear any sensitive data in case of error
    if (resetToken) resetToken = null;
    if (hashedResetToken) hashedResetToken = null;
    
    response.status(500).json({
      success: false,
      message: "Internal server error during password reset request"
    });
  }
};

module.exports = forgotPassword;

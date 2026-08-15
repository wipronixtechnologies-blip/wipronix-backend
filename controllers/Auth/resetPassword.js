const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Student = require('../../models/Student.model');
const { resetPasswordSchema } = require('../../src/services/validationSchema');

const resetPassword = async (request, response, next) => {
  try {
    // Validate input using Joi
    const validatedData = await resetPasswordSchema.validateAsync(request.body);
    const { token, email, newPassword } = validatedData;

    // Find student by email
    const student = await Student.findOne({ email: email.toLowerCase().trim() });
    if (!student) {
      return response.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Check if token matches and is not expired
    if (student.resetPasswordToken !== hashedToken) {
      return response.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    if (student.resetPasswordExpires < Date.now()) {
      return response.status(400).json({
        success: false,
        message: 'Reset token has expired. Please request a new password reset.'
      });
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update student's password and clear reset token fields
    await Student.findByIdAndUpdate(student._id, {
      password: hashedNewPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined
    });

    // Clear sensitive data from memory
    const clearSensitiveData = () => {
      if (token) token = null;
      if (hashedToken) hashedToken = null;
      if (newPassword) newPassword = null;
      if (hashedNewPassword) hashedNewPassword = null;
    };

    clearSensitiveData();

    response.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
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

    console.error("Reset password error:", error);
    
    // Clear any sensitive data in case of error
    const clearSensitiveData = () => {
      if (token) token = null;
      if (hashedToken) hashedToken = null;
      if (newPassword) newPassword = null;
      if (hashedNewPassword) hashedNewPassword = null;
    };

    clearSensitiveData();
    
    response.status(500).json({
      success: false,
      message: "Internal server error during password reset"
    });
  }
};

module.exports = resetPassword;

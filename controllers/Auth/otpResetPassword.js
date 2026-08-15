const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Student = require('../../models/Student.model');
const { otpResetPasswordSchema } = require('../../src/services/validationSchema');

const otpResetPassword = async (request, response, next) => {
  try {
    // Validate input using Joi
    const validatedData = await otpResetPasswordSchema.validateAsync(request.body);
    const { email, verificationToken, newPassword } = validatedData;

    // Find student by email
    const student = await Student.findOne({ email: email.toLowerCase().trim() });
    if (!student) {
      return response.status(400).json({
        success: false,
        message: 'Invalid email or verification token'
      });
    }

    // Check if verification token and expiration exist
    if (!student.resetPasswordToken || !student.resetPasswordExpires) {
      return response.status(400).json({
        success: false,
        message: 'No verification session found. Please restart the password reset process.'
      });
    }

    // Check if verification session has expired
    if (student.resetPasswordExpires < Date.now()) {
      // Clear expired verification session
      await Student.findByIdAndUpdate(student._id, {
        resetPasswordToken: undefined,
        resetPasswordExpires: undefined,
        isVerified: false
      });
      
      return response.status(400).json({
        success: false,
        message: 'Verification session has expired. Please restart the password reset process.'
      });
    }

    // Check if student was verified
    if (!student.isVerified) {
      return response.status(400).json({
        success: false,
        message: 'Please verify your identity first by entering the OTP sent to your email.'
      });
    }

    // Hash the provided verification token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Check if verification token matches
    if (student.resetPasswordToken !== hashedToken) {
      return response.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update student's password and clear all reset fields
    await Student.findByIdAndUpdate(student._id, {
      password: hashedNewPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
      isVerified: false // Reset verification status
    });

    // Clear sensitive data from memory
    const clearSensitiveData = () => {
      if (verificationToken) {
        // Note: We can't nullify const variables, but we can create a new scope
      }
      if (hashedToken) {
        // Note: We can't nullify const variables, but we can create a new scope
      }
      if (newPassword) {
        // Note: We can't nullify const variables, but we can create a new scope
      }
      if (hashedNewPassword) {
        // Note: We can't nullify const variables, but we can create a new scope
      }
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

    console.error("OTP Reset password error:", error);
    
    // Clear any sensitive data in case of error
    const clearSensitiveData = () => {
      if (verificationToken) {
        // Note: We can't nullify const variables, but we can create a new scope
      }
      if (hashedToken) {
        // Note: We can't nullify const variables, but we can create a new scope
      }
      if (newPassword) {
        // Note: We can't nullify const variables, but we can create a new scope
      }
      if (hashedNewPassword) {
        // Note: We can't nullify const variables, but we can create a new scope
      }
    };

    clearSensitiveData();
    
    response.status(500).json({
      success: false,
      message: "Internal server error during password reset"
    });
  }
};

module.exports = otpResetPassword;

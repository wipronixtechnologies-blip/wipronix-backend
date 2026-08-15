const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Staff = require('../../models/Staff.model');
const { otpResetPasswordSchema } = require('../../src/services/validationSchema');

const staffOtpResetPassword = async (request, response, next) => {
  try {
    // Validate input using Joi
    const validatedData = await otpResetPasswordSchema.validateAsync(request.body);
    const { email, verificationToken, newPassword } = validatedData;

    // Find staff by email
    const staff = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (!staff) {
      return response.status(400).json({
        success: false,
        message: 'Invalid email or verification token'
      });
    }

    // Check if verification token and expiration exist
    if (!staff.resetPasswordToken || !staff.resetPasswordExpires) {
      return response.status(400).json({
        success: false,
        message: 'No verification session found. Please restart the password reset process.'
      });
    }

    // Check if verification session has expired
    if (staff.resetPasswordExpires < Date.now()) {
      // Clear expired verification session
      await Staff.findByIdAndUpdate(staff._id, {
        resetPasswordToken: undefined,
        resetPasswordExpires: undefined,
        isVerified: false
      });
      
      return response.status(400).json({
        success: false,
        message: 'Verification session has expired. Please restart the password reset process.'
      });
    }

    // Check if staff was verified
    if (!staff.isVerified) {
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
    if (staff.resetPasswordToken !== hashedToken) {
      return response.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update staff's password and clear all reset fields
    await Staff.findByIdAndUpdate(staff._id, {
      password: hashedNewPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
      isVerified: false // Reset verification status
    });

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

    console.error("Staff OTP Reset password error:", error);
    
    response.status(500).json({
      success: false,
      message: "Internal server error during password reset"
    });
  }
};

module.exports = staffOtpResetPassword;


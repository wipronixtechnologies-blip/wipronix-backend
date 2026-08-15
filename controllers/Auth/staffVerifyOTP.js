const crypto = require('crypto');
const Staff = require('../../models/Staff.model');
const { verifyOTPSchema } = require('../../src/services/validationSchema');

const staffVerifyOTP = async (request, response, next) => {
  try {
    // Validate input using Joi
    const validatedData = await verifyOTPSchema.validateAsync(request.body);
    const { email, otp } = validatedData;

    // Find staff by email
    const staff = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (!staff) {
      return response.status(400).json({
        success: false,
        message: 'Invalid email or OTP'
      });
    }

    // Check if OTP and expiration exist
    if (!staff.resetPasswordToken || !staff.resetPasswordExpires) {
      return response.status(400).json({
        success: false,
        message: 'No OTP request found. Please request a new OTP.'
      });
    }

    // Check if OTP has expired
    if (staff.resetPasswordExpires < Date.now()) {
      // Clear expired OTP
      await Staff.findByIdAndUpdate(staff._id, {
        resetPasswordToken: undefined,
        resetPasswordExpires: undefined,
        isVerified: false
      });
      
      return response.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Hash the provided OTP to compare with stored hash
    const hashedOTP = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');

    // Check if OTP matches
    if (staff.resetPasswordToken !== hashedOTP) {
      return response.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    // OTP is valid - generate a temporary verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Set verification token expiration (15 minutes from now)
    const verificationExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Update staff with verification token and extend expiration
    await Staff.findByIdAndUpdate(staff._id, {
      resetPasswordToken: hashedVerificationToken,
      resetPasswordExpires: verificationExpires,
      isVerified: true // Mark as verified for password reset
    });

    response.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      verificationToken: verificationToken,
      expiresIn: '15 minutes'
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

    console.error("Staff verify OTP error:", error);
    
    response.status(500).json({
      success: false,
      message: "Internal server error during OTP verification"
    });
  }
};

module.exports = staffVerifyOTP;


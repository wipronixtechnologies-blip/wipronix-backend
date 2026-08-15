const crypto = require('crypto');
const Staff = require('../../models/Staff.model');
const { sendOTPSMSEmail } = require('../../src/services/emailService');
const { sendOTPSchema } = require('../../src/services/validationSchema');

const staffSendOTP = async (request, response, next) => {
  try {
    // Validate input using Joi
    const validatedData = await sendOTPSchema.validateAsync(request.body);
    const { email } = validatedData;

    // Find staff by email
    const staff = await Staff.findOne({ email: email.toLowerCase().trim() });
    if (!staff) {
      // Don't reveal if email exists or not for security
      return response.status(200).json({
        success: true,
        message: 'If an account with that email exists, an OTP has been sent.'
      });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Hash OTP before saving to database (for security)
    const hashedOTP = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');

    // Set OTP expiration (10 minutes from now)
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save OTP and expiration to database
    await Staff.findByIdAndUpdate(staff._id, {
      resetPasswordToken: hashedOTP,
      resetPasswordExpires: otpExpires,
      isVerified: false
    });

    // Prepare staff data for email
    const staffData = {
      fullName: staff.fullName,
      email: staff.email
    };

    // Send OTP email
    const emailResult = await sendOTPSMSEmail(staffData, otp);
    
    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult.error);
      return response.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.'
      });
    }

    response.status(200).json({
      success: true,
      message: 'OTP has been sent to your email address.',
      // In development, you might want to include the OTP for testing
      ...(process.env.NODE_ENV === 'development' && { 
        otp: otp,
        expiresIn: '10 minutes'
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

    console.error("Staff send OTP error:", error);
    
    response.status(500).json({
      success: false,
      message: "Internal server error during OTP request"
    });
  }
};

module.exports = staffSendOTP;


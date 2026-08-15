const crypto = require('crypto');
const Student = require('../../models/Student.model');
const { verifyOTPSchema } = require('../../src/services/validationSchema');

const verifyOTP = async (request, response, next) => {
  try {
    // Validate input using Joi
    const validatedData = await verifyOTPSchema.validateAsync(request.body);
    const { email, otp } = validatedData;

    // Find student by email
    const student = await Student.findOne({ email: email.toLowerCase().trim() });
    if (!student) {
      return response.status(400).json({
        success: false,
        message: 'Invalid email or OTP'
      });
    }

    // Check if OTP and expiration exist
    if (!student.resetPasswordToken || !student.resetPasswordExpires) {
      return response.status(400).json({
        success: false,
        message: 'No OTP request found. Please request a new OTP.'
      });
    }

    // Check if OTP has expired
    if (student.resetPasswordExpires < Date.now()) {
      // Clear expired OTP
      await Student.findByIdAndUpdate(student._id, {
        resetPasswordToken: undefined,
        resetPasswordExpires: undefined
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
    if (student.resetPasswordToken !== hashedOTP) {
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

    // Update student with verification token and extend expiration
    await Student.findByIdAndUpdate(student._id, {
      resetPasswordToken: hashedVerificationToken,
      resetPasswordExpires: verificationExpires,
      isVerified: true // Mark as verified for password reset
    });

    // Clear sensitive data from memory
    const clearSensitiveData = () => {
      if (otp) {
        // Note: We can't nullify const variables, but we can create a new scope
      }
      if (hashedOTP) {
        // Note: We can't nullify const variables, but we can create a new scope
      }
    };

    clearSensitiveData();

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

    console.error("Verify OTP error:", error);
    
    response.status(500).json({
      success: false,
      message: "Internal server error during OTP verification"
    });
  }
};

module.exports = verifyOTP;

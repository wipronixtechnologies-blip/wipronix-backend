const crypto = require('crypto');
const Student = require('../../models/Student.model');
const { sendOTPSMSEmail } = require('../../src/services/emailService');
const { sendOTPSchema } = require('../../src/services/validationSchema');

const sendOTP = async (request, response, next) => {
  try {
    // Validate input using Joi
    const validatedData = await sendOTPSchema.validateAsync(request.body);
    const { email } = validatedData;

    // Find student by email
    const student = await Student.findOne({ email: email.toLowerCase().trim() });
    if (!student) {
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
    await Student.findByIdAndUpdate(student._id, {
      resetPasswordToken: hashedOTP,
      resetPasswordExpires: otpExpires
    });

    // Prepare student data for email
    const studentData = {
      fullName: student.fullName,
      email: student.email
    };

    // Send OTP email
    const emailResult = await sendOTPSMSEmail(studentData, otp);
    
    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult.error);
      return response.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.'
      });
    }

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

    console.error("Send OTP error:", error);
    
    response.status(500).json({
      success: false,
      message: "Internal server error during OTP request"
    });
  }
};

module.exports = sendOTP;

const Joi = require('joi');

// Register validation schema
const registerSchema = Joi.object({
  userType: Joi.string().valid('Student', 'Admin').default('Student'),
  fullName: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Full name is required',
    'string.min': 'Full name must be at least 2 characters long',
    'string.max': 'Full name cannot exceed 100 characters'
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 6 characters long',
    'string.max': 'Password cannot exceed 128 characters'
  }),
  confirmPassword: Joi.string().min(6).max(128).required().valid(Joi.ref('password')).messages({
    'string.empty': 'Confirm password is required',
    'string.min': 'Confirm password must be at least 6 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'any.only': 'Password and confirm password must match'
  }),
  phoneNumber: Joi.string().pattern(/^[0-9]{10,15}$/).required().messages({
    'string.empty': 'Phone number is required',
    'string.pattern.base': 'Please provide a valid phone number (10-15 digits)'
  }),
  city: Joi.string().min(2).max(50).required().messages({
    'string.empty': 'City is required',
    'string.min': 'City name must be at least 2 characters long',
    'string.max': 'City name cannot exceed 50 characters'
  }),
  education: Joi.string().required().messages({
    'string.empty': 'Education level is required'
  }),
  course: Joi.string().required().messages({
    'string.empty': 'Course selection is required'
  }),
  college: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'College name is required',
    'string.min': 'College name must be at least 2 characters long',
    'string.max': 'College name cannot exceed 100 characters'
  }),
  passingYear: Joi.string().required().messages({
    'string.empty': 'Passing year is required'
  }),
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({
    'any.only': 'Password and confirm password must match',
    'string.empty': 'Confirm password is required'
  })
});

// Login validation schema
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required'
  })
});

// Forgot password validation schema
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address'
  })
});

// Reset password validation schema
const resetPasswordSchema = Joi.object({
  token: Joi.string().min(10).max(200).required().messages({
    'string.empty': 'Reset token is required',
    'string.min': 'Reset token must be at least 10 characters long',
    'string.max': 'Reset token cannot exceed 200 characters'
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address'
  }),
  newPassword: Joi.string().min(6).max(128).required().messages({
    'string.empty': 'New password is required',
    'string.min': 'New password must be at least 6 characters long',
    'string.max': 'New password cannot exceed 128 characters'
  })
});

// Send OTP validation schema
const sendOTPSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address'
  })
});

// Verify OTP validation schema
const verifyOTPSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address'
  }),
  otp: Joi.string().pattern(/^[0-9]{6}$/).required().messages({
    'string.empty': 'OTP is required',
    'string.pattern.base': 'OTP must be exactly 6 digits'
  })
});

// OTP reset password validation schema
const otpResetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address'
  }),
  verificationToken: Joi.string().min(10).max(200).required().messages({
    'string.empty': 'Verification token is required',
    'string.min': 'Verification token must be at least 10 characters long',
    'string.max': 'Verification token cannot exceed 200 characters'
  }),
  newPassword: Joi.string().min(6).max(128).required().messages({
    'string.empty': 'New password is required',
    'string.min': 'New password must be at least 6 characters long',
    'string.max': 'New password cannot exceed 128 characters'
  })
});

// Staff register validation schema
const staffRegisterSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.empty': 'First name is required',
    'string.min': 'First name must be at least 2 characters long',
    'string.max': 'First name cannot exceed 50 characters'
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.empty': 'Last name is required',
    'string.min': 'Last name must be at least 2 characters long',
    'string.max': 'Last name cannot exceed 50 characters'
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 6 characters long',
    'string.max': 'Password cannot exceed 128 characters'
  }),
  department: Joi.string().max(100).allow('').optional(),
  designation: Joi.string().max(100).allow('').optional(),
  systemRole: Joi.string().valid('super_admin', 'admin', 'staff', 'employee', 'hr').default('employee'),
  employeeType: Joi.string().valid('full_time', 'part_time', 'contract', 'intern').default('full_time')
});

// Staff login validation schema
const staffLoginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required'
  })
});

// Export all schemas
module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sendOTPSchema,
  verifyOTPSchema,
  otpResetPasswordSchema,
  staffRegisterSchema,
  staffLoginSchema
};

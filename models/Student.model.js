const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    // Basic Information
    userType: {
      type: String,
      default: 'Student'
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      minLength: 6
    },
    phoneNumber: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    
    // Education Information (Flexible without enum restrictions)
    education: {
      type: String,
      trim: true
    },
    course: {
      type: String,
      trim: true
    },
    college: {
      type: String,
      trim: true
    },
    passingYear: {
      type: String,
      trim: true
    },
    
    // Test/Application Information
    testId: String,
    semester: String,
    batch: String,
    technology: {
      type: String,
      trim: true
    },
    
    // Authentication
    isVerified: {
      type: Boolean,
      default: false
    },
    lastLogin: Date,
    
    // Password Reset
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    // Result Declaration
    resultDeclared: {
      type: Boolean,
      default: false
    },
    
    // Profile Picture
    profilePicture: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

studentSchema.index({ phoneNumber: 1 });
studentSchema.index({ resetPasswordToken: 1, resetPasswordExpires: 1 });

module.exports = mongoose.model("Student", studentSchema);

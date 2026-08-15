const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    // Basic Information
    userType: {
      type: String,
      enum: ['Student', 'Admin'],
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
    
    // Education Information
    education: {
      type: String,
      enum: ['10th', '12th', 'Graduate', 'Post Graduate']
    },
    course: {
      type: String,
      enum: ['Full Stack', 'Frontend', 'Backend', 'Data Science', 'DevOps', 'Mobile Development']
    },
    college: {
      type: String,
      trim: true
    },
    passingYear: {
      type: String,
      enum: ['2024', '2025', '2026', '2027', '2028']
    },
    
    // Test/Application Information
    testId: String,
    semester: String,
    batch: String,
    technology: {
      type: String,
      enum: ['MernStack', 'AI / ML', 'PythonWebDevelopment', 'GraphicDesign', 'DataAnalytics', 'MobileAppDevelopment']
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

// Index for better query performance (email index created automatically by unique: true)
studentSchema.index({ phoneNumber: 1 });
studentSchema.index({ resetPasswordToken: 1, resetPasswordExpires: 1 });

module.exports = mongoose.model("Student", studentSchema);

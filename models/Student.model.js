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
    },

    // Counselor & BDE Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null
    },
    assignedAt: {
      type: Date,
      default: null
    },
    counselingStatus: {
      type: String,
      enum: ['unassigned', 'assigned', 'contacted', 'interested', 'not_interested', 'enrolled', 'rejected'],
      default: 'unassigned'
    },
    counselingNotes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

studentSchema.index({ phoneNumber: 1 });
studentSchema.index({ resetPasswordToken: 1, resetPasswordExpires: 1 });
// Allow same email for different technologies, but not same email+technology twice
studentSchema.index({ email: 1, technology: 1 }, { unique: true });
studentSchema.index({ college: 1, createdAt: -1 });
studentSchema.index({ createdAt: -1 });
studentSchema.index({ assignedTo: 1, college: 1 });
studentSchema.index({ college: 1, assignedTo: 1 });

module.exports = mongoose.model("Student", studentSchema);

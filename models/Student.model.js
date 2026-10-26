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
    alternatePhoneNumber: {
      type: String,
      trim: true,
      default: ''
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
    testTrack: {
      type: String,
      enum: ['technical', 'non-technical'],
      default: 'technical'
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

    // Lead Source routing
    source: {
      type: String,
      enum: ['organic', 'test', 'import'],
      default: 'organic'
    },

    // Result Declaration & Selection Status
    resultDeclared: {
      type: Boolean,
      default: false
    },
    isSelected: {
      type: Boolean,
      default: false,
      index: true
    },
    isShortlisted: {
      type: Boolean,
      default: false,
      index: true
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
    createdBy: {
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
      default: 'assigned'
    },
    counselingNotes: {
      type: String,
      default: ''
    },

    // 5 Parent Lead Stages & Sub-Stages
    leadStage: {
      type: String,
      trim: true,
      default: ''
    },
    leadSubStage: {
      type: String,
      trim: true,
      default: ''
    },

    // Demo Session Details
    demoTechnology: {
      type: String,
      trim: true,
      default: ''
    },
    demoTiming: {
      type: Date,
      default: null
    },
    demoStatus: {
      type: String,
      default: 'pending'
    },

    // Admission Details
    admissionTechnology: {
      type: String,
      trim: true,
      default: ''
    },
    admissionDate: {
      type: Date,
      default: null
    },
    admissionFee: {
      type: Number,
      default: null
    },

    // Inactivity & Untouched Tracking
    lastTouchedAt: {
      type: Date,
      default: Date.now
    },
    lastTouchedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null
    },
    lastTouchedByName: {
      type: String,
      default: ''
    },

    // Call Logs & Follow-up History
    callLogs: [
      {
        calledAt: { type: Date, default: Date.now },
        calledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
        calledByName: { type: String, default: '' },
        callOutcome: { type: String, default: 'connected' },
        notes: { type: String, default: '' },
        nextFollowUpDate: { type: Date, default: null }
      }
    ],
    lastContactedAt: { type: Date, default: null },
    nextFollowUpDate: { type: Date, default: null },
    followUpRemarks: { type: String, default: '' },

    // Counselor Generated Assessment Session Token & Results
    testToken: { type: String, default: null, index: true },
    testTokenExpires: { type: Date, default: null },
    testTokenStatus: {
      type: String,
      enum: ['none', 'generated', 'started', 'completed', 'expired'],
      default: 'none'
    },
    testLinkGeneratedAt: { type: Date, default: null },
    testScore: { type: Number, default: null },
    testPercentage: { type: Number, default: null },
    testStatus: { type: String, default: null },
    testTotalQuestions: { type: Number, default: null },
    testCorrect: { type: Number, default: null },
    testAttempted: { type: Number, default: null },
    testCompletedAt: { type: Date, default: null },
    testResultId: { type: mongoose.Schema.Types.ObjectId, ref: 'Result', default: null },

    // Smart Cut Reassessment & Discovery Invitation Tracking
    smartCutInvited: { type: Boolean, default: false },
    smartCutInvitedAt: { type: Date, default: null },
    smartCutChannel: { type: String, enum: ['email', 'whatsapp', 'both', 'none'], default: 'none' },
    smartCutInviteCount: { type: Number, default: 0 }
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

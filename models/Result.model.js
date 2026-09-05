const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true
    },
    studentName: {
      type: String,
      trim: true
    },
    studentEmail: {
      type: String,
      trim: true
    },
    studentPhone: {
      type: String,
      trim: true
    },
    collegeName: {
      type: String,
      trim: true,
      index: true
    },
    eventCode: {
      type: String,
      trim: true,
      index: true
    },
    course: {
      type: String,
      trim: true
    },
    semester: {
      type: String,
      trim: true
    },
    technology: {
      type: String,
      trim: true
    },
    testId: {
      type: String,
      required: true
    },
    totalQuestions: {
      type: Number,
      default: 30
    },
    attempted: {
      type: Number,
      default: 0
    },
    correct: {
      type: Number,
      default: 0
    },
    score: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['PASS', 'FAIL', 'IN_PROGRESS'],
      default: 'IN_PROGRESS'
    },
    isShortlisted: {
      type: Boolean,
      default: false
    },
    technicalRoundMarks: {
      type: Number,
      default: null
    },
    aiRoundMarks: {
      type: Number,
      default: null
    },
    screeningRoundMarks: {
      type: Number,
      default: null
    },
    isSelected: {
      type: Boolean,
      default: false
    },
    offerLetterSent: {
      type: Boolean,
      default: false
    },
    offerLetterSentDate: {
      type: Date,
      default: null
    },
    answers: Object,
    resultDeclared: {
      type: Boolean,
      default: true
    },
    // Machine Coding Round fields
    hasMachineRound: {
      type: Boolean,
      default: false
    },
    machineRoundStatus: {
      type: String,
      enum: ['NOT_APPLICABLE', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'],
      default: 'NOT_APPLICABLE'
    },
    machineRoundTechnology: {
      type: String,
      default: ''
    },
    machineRoundChallengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MachineChallenge',
      default: null
    },
    machineRoundChallengeTitle: {
      type: String,
      default: ''
    },
    machineRoundCode: {
      type: String,
      default: ''
    },
    machineRoundLanguage: {
      type: String,
      default: 'javascript'
    },
    machineRoundScore: {
      type: Number,
      default: 0
    },
    machineRoundPassedTestCases: {
      type: Number,
      default: 0
    },
    machineRoundTotalTestCases: {
      type: Number,
      default: 0
    },
    machineRoundTimeSpent: {
      type: Number,
      default: 0
    },
    machineRoundSubmittedAt: {
      type: Date,
      default: null
    },
    machineRoundConsoleOutput: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

// High performance indexes for scale (500+ to 50,000+ candidates)
resultSchema.index({ collegeName: 1, createdAt: -1 });
resultSchema.index({ eventCode: 1, createdAt: -1 });
resultSchema.index({ studentEmail: 1 });
resultSchema.index({ isShortlisted: 1 });
resultSchema.index({ isSelected: 1 });
resultSchema.index({ status: 1 });
resultSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Result", resultSchema, "results");

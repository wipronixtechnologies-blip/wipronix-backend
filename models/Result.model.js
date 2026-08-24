const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
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
    testId: {
      type: String,
      required: true
    },
    totalQuestions: {
      type: Number,
      default: 20
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
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Result", resultSchema, "results");

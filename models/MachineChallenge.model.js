const mongoose = require("mongoose");

const testCaseSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      default: ""
    },
    expectedOutput: {
      type: String,
      required: true
    },
    isHidden: {
      type: Boolean,
      default: false
    },
    explanation: {
      type: String,
      default: ""
    }
  },
  { _id: true }
);

const machineChallengeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    technology: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium"
    },
    timeMinutes: {
      type: Number,
      default: 30
    },
    description: {
      type: String,
      required: true
    },
    constraints: {
      type: String,
      default: "Time Limit: 2.0s | Memory Limit: 256MB"
    },
    starterCodes: {
      type: Object,
      default: {}
    },
    defaultLanguage: {
      type: String,
      default: "javascript"
    },
    solutionFunctionName: {
      type: String,
      default: "solve"
    },
    testCases: [testCaseSchema],
    totalMarks: {
      type: Number,
      default: 10
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MachineChallenge", machineChallengeSchema);

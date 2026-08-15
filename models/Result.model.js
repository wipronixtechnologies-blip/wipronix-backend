const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    testId: {
      type: String,
      required: true
    },
    totalQuestions: Number,
    attempted: Number,
    correct: Number,
    score: Number,
    answers: Object,
    resultDeclared: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Result", resultSchema);

const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    testId: {
      type: String,
      required: true,
      index: true
    },
    eventCode: {
      type: String,
      index: true
    },
    type: {
      type: String,
      default: 'technology'
    },
    technology: {
      type: String,
      default: 'General'
    },
    question: {
      type: String,
      required: true
    },
    codeSnippet: {
      type: String,
      default: ''
    },
    options: {
      type: [String],
      required: true
    },
    correctAnswer: {
      type: Number, // index of option (0, 1, 2, 3)
      required: true,
      select: false   // ❌ never send to frontend automatically
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);


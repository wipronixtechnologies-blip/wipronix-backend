const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    testId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['aptitude', 'technology'],
      required: true
    },
    technology: {
      type: String,
      enum: ['MernStack', 'AI / ML', 'PythonWebDevelopment', 'GraphicDesign', 'DataAnalytics', 'MobileAppDevelopment'],
      required: function() { return this.type === 'technology'; }
    },
    question: {
      type: String,
      required: true
    },
    options: {
      type: [String],
      required: true
    },
    correctAnswer: {
      type: Number, // index of option
      required: true,
      select: false   // ❌ never send to frontend
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);

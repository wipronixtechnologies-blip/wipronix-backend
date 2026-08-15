const mongoose = require("mongoose");

const eventTestSchema = new mongoose.Schema(
  {
    eventCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    collegeName: {
      type: String,
      required: true,
      trim: true
    },
    testTitle: {
      type: String,
      required: true,
      trim: true
    },
    technology: {
      type: String,
      default: "General Technical & Aptitude"
    },
    durationMinutes: {
      type: Number,
      default: 20
    },
    questionsCount: {
      type: Number,
      default: 20
    },
    passPercentage: {
      type: Number,
      default: 70
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("EventTest", eventTestSchema);

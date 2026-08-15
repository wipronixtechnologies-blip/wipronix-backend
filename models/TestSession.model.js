const mongoose = require("mongoose");

const testSessionSchema = new mongoose.Schema(
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
    startedAt: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ["STARTED", "SUBMITTED"],
      default: "STARTED"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TestSession", testSessionSchema);

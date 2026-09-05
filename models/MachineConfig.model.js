const mongoose = require("mongoose");

const machineConfigSchema = new mongoose.Schema(
  {
    technology: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    hasMachineRound: {
      type: Boolean,
      default: true
    },
    durationMinutes: {
      type: Number,
      default: 30
    },
    description: {
      type: String,
      default: ""
    },
    category: {
      type: String,
      enum: ["Technical", "Non-Technical", "Design", "Management", "General"],
      default: "Technical"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MachineConfig", machineConfigSchema);

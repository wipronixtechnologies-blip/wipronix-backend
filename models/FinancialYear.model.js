const mongoose = require('mongoose');

const financialYearSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    startMonth: {
      type: Number,
      required: true, // 1-indexed: 4 = April
    },
    startYear: {
      type: Number,
      required: true,
    },
    endMonth: {
      type: Number,
      required: true, // 1-indexed: 3 = March
    },
    endYear: {
      type: Number,
      required: true,
    },
    startDate: {
      type: String,
      required: true, // YYYY-MM-DD
    },
    endDate: {
      type: String,
      required: true, // YYYY-MM-DD
    },
    casualLeaves: {
      type: Number,
      default: 12,
    },
    medicalLeaves: {
      type: Number,
      default: 10,
    },
    maternityLeaves: {
      type: Number,
      default: 15,
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FinancialYear', financialYearSchema);

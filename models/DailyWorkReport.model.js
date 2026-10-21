const mongoose = require('mongoose');

const dailyWorkReportSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  date: {
    type: String, // YYYY-MM-DD format
    required: true
  },
  title: {
    type: String,
    trim: true,
    default: 'Daily Work Report'
  },
  tasksSummary: {
    type: String,
    required: true,
    trim: true
  },
  challengesBlockers: {
    type: String,
    trim: true,
    default: ''
  },
  planForTomorrow: {
    type: String,
    trim: true,
    default: ''
  },
  hoursWorked: {
    type: Number,
    default: 8
  },
  workLinks: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewRemarks: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Unique index: one report per staff member per date
dailyWorkReportSchema.index({ staff: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyWorkReport', dailyWorkReportSchema);

const mongoose = require('mongoose');

const resignationSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  reason: {
    type: String,
    enum: ['Career Growth', 'Compensation', 'Education', 'Personal Reasons', 'Other'],
    required: true
  },
  otherReason: {
    type: String,
    trim: true
  },
  preferredLastWorkingDay: {
    type: Date,
    required: true
  },
  noticePeriodDays: {
    type: Number,
    required: true
  },
  expectedLastWorkingDay: { // Calculated by system
    type: Date,
    required: true
  },
  shortfallDays: { // If preferred < expected
    type: Number,
    default: 0
  },
  attachment: {
    type: String, // URL to PDF
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Withdrawn'],
    default: 'Pending'
  },
  // Workflow tracking
  workflowStage: {
    type: String,
    enum: ['Manager Review', 'HR Review', 'Final Approval', 'Completed', 'Rejected'],
    default: 'Manager Review'
  },
  managerApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    comment: String,
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    actionDate: Date
  },
  hrApproval: {
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    comment: String,
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    actionDate: Date
  },
  finalExitConfirmation: {
    exitDate: Date,
    comment: String,
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    actionDate: Date
  },
  hrComments: { // Kept for backward compatibility or general marks
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

const Resignation = mongoose.model('Resignation', resignationSchema);

module.exports = Resignation;

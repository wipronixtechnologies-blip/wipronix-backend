const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  platform: {
    type: String,
    enum: ['Instagram', 'Google', 'Facebook', 'LinkedIn', 'College', 'Other'],
    required: true
  },
  budget: {
    type: Number,
    required: true
  },
  spent: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  leadsGenerated: {
    type: Number,
    default: 0
  },
  conversions: {
      type: Number,
      default: 0
  },
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Paused', 'Pending'],
    default: 'Active'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Campaign', campaignSchema);

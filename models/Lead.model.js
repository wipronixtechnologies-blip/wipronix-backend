const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    enum: ['Ads', 'Social Media', 'Referral', 'Google', 'College', 'Other'],
    default: 'Other'
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Interested', 'Converted', 'Dropped'],
    default: 'New'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  notes: {
    type: String
  },
  cost: { // Used for calculate Cost per Lead
      type: Number, 
      default: 0 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Lead', leadSchema);

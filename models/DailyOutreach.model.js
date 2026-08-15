const mongoose = require('mongoose');

const dailyOutreachSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff', 
    required: true
  },
  date: {
    type: Date,
    required: true, 
    default: Date.now
  },
  calls: {
    type: Number,
    default: 0
  },
  messages: {
    type: Number, 
    default: 0
  },
  emails: {
    type: Number,
    default: 0
  },
  leadsGenerated: {
    type: Number,
    default: 0
  },
  conversions: {
    type: Number,
    default: 0
  },
  incentive: {
    type: Number, 
    default: 0
  }
}, {
  timestamps: true
});

dailyOutreachSchema.index({ staff: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyOutreach', dailyOutreachSchema);

const mongoose = require('mongoose');

const studentInteractionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  type: {
    type: String,
    enum: ['Call', 'Message', 'Meeting', 'Email'],
    default: 'Call'
  },
  outcome: {
    type: String,
    enum: [
      'Already doing internship', 
      'Looking for job', 
      'Not picked', 
      'Follow up', 
      'Busy', 
      'Not interested', 
      'Converted',
      'Other'
    ],
    required: true
  },
  additionalRemarks: {
    type: String,
    trim: true
  },
  reminderDate: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('StudentInteraction', studentInteractionSchema);

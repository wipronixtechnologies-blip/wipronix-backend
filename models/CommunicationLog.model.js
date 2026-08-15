const mongoose = require('mongoose');

const communicationLogSchema = new mongoose.Schema({
  proposal: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Proposal', 
      required: true 
  },
  type: { 
      type: String, 
      enum: ['Call', 'Email', 'Meeting', 'Other'], 
      required: true 
  },
  summary: { 
      type: String, 
      required: true 
  },
  date: { 
      type: Date, 
      default: Date.now 
  },
  loggedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Staff' 
  }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('CommunicationLog', communicationLogSchema);

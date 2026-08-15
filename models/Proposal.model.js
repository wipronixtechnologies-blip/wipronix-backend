const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  title: { 
      type: String, 
      required: true,
      trim: true
  },
  clientName: { 
      type: String, 
      required: true,
      trim: true
  },
  clientContact: { 
      type: String,
      trim: true
  },
  requirements: { 
      type: String 
  },
  proposalDocument: { 
      type: String // URL to document
  },
  quotedAmount: { 
      type: Number, 
      required: true 
  },
  submissionDate: { 
      type: Date 
  },
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Negotiation', 'Won', 'Lost'],
    default: 'Draft'
  },
  assignedTo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Staff' 
  },
  
  // Revenue Tracking
  expectedValue: { 
      type: Number 
  },
  closedValue: { 
      type: Number,
      default: 0
  },

  // Handover to Tech Team
  handover: {
    projectScope: String,
    timeline: String,
    techStack: [String],
    handoverDate: Date
  }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Proposal', proposalSchema);

const mongoose = require('mongoose');

const placementProposalSchema = new mongoose.Schema({
  college: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  type: {
    type: String,
    enum: ['Training', 'Placement', 'Internship'],
    required: true
  },
  title: {
    type: String,
    required: true, 
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  validUntil: {
    type: Date
  },
  stipendSalary: {
    type: String,
    trim: true
  },
  proposalDocument: {
    type: String // URL
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Negotiation', 'Accepted', 'Rejected'],
    default: 'Draft'
  },
  followUp: [{
    date: Date,
    response: String,
    nextActionDate: Date,
    notes: String,
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PlacementProposal', placementProposalSchema);

const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
  },
  employeeEmail: {
    type: String
  },
  category: {
    type: String,
    enum: ['it_support', 'hr_query', 'payroll', 'leave', 'certificate_request', 'other'],
    required: true
  },
  subcategory: {
    type: String
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileSize: Number
  }],
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_response', 'resolved', 'closed', 'cancelled'],
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  assignedToName: {
    type: String
  },
  assignedAt: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  closedAt: {
    type: Date
  },
  resolution: {
    type: String
  },
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    authorName: String,
    comment: String,
    isInternal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String
  }
}, {
  timestamps: true
});

// Auto-generate ticket number
ticketSchema.pre('save', async function() {
  if (!this.ticketNumber) {
    const count = await mongoose.model('Ticket').countDocuments();
    const year = new Date().getFullYear();
    this.ticketNumber = `TKT-${year}-${String(count + 1).padStart(5, '0')}`;
  }
});

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;

const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String, // pdf, doc, image, etc.
    required: true
  },
  url: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: '0 KB'
  },
  category: {
    type: String,
    enum: ['Personal', 'Policy', 'Legal', 'Payroll', 'Other'],
    default: 'Other'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  // If null, it's a public/company document (like Policy). If set, it's private to that staff.
  uploadedFor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationNotes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Document', documentSchema);

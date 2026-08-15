const mongoose = require('mongoose');

// College schema
const collegeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    pinCode: { type: String, trim: true }
  },
  contact: {
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true }
  },
  // Technologies offered by the college
  technologies: [{
    name: { type: String, trim: true },
    description: { type: String }
  }],
  // Education programs like B.Tech, MCA, etc.
  educationPrograms: [{
    name: { type: String, trim: true },
    type: { 
      type: String, 
      enum: ['undergraduate', 'postgraduate', 'diploma', 'certificate'],
      default: 'undergraduate'
    },
    duration: { type: String },
    branches: [{ type: String }]
  }],
  // POC (Point of Contact) for the college
  poc: {
    name: { type: String, trim: true },
    designation: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'blocked'],
    default: 'active'
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  }
}, {
  timestamps: true
});

// Index for search
collegeSchema.index({ name: 'text', 'location.city': 'text' });

const College = mongoose.model('College', collegeSchema);

module.exports = College;


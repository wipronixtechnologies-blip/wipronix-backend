const mongoose = require('mongoose');

const driveCandidateSchema = new mongoose.Schema({
  drive: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlacementDrive',
    required: true
  },
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  college: {
      type: String // In case the drive is pooled
  },
  resumeUrl: {
      type: String
  },
  status: {
    type: String,
    enum: ['Registered', 'Shortlisted', 'Interviewed', 'Selected', 'Rejected'],
    default: 'Registered'
  },
  marks: {
      aptitude: Number,
      technical: Number,
      hr: Number
  },
  remarks: {
      type: String
  }
}, {
  timestamps: true
});

driveCandidateSchema.index({ drive: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('DriveCandidate', driveCandidateSchema);

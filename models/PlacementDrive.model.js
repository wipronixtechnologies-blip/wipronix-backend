const mongoose = require('mongoose');

const placementDriveSchema = new mongoose.Schema({
  college: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  driveDate: {
    type: Date,
    required: true
  },
  mode: {
    type: String,
    enum: ['Online', 'Offline', 'Hybrid'],
    required: true
  },
  coursesOffered: [{
    type: String,
    trim: true
  }], // What job roles/courses are being offered
  eligibilityCriteria: {
    branches: [String],
    cgpa: Number,
    backlogsAllowed: { type: Number, default: 0 }
  },
  description: {
    type: String
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  },
  candidates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DriveCandidate'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('PlacementDrive', placementDriveSchema);

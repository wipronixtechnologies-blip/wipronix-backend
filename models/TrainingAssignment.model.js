const mongoose = require('mongoose');

const trainingAssignmentSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
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
  category: {
    type: String,
    enum: ['technical', 'soft_skills', 'mandatory', 'commercial', 'other'],
    default: 'technical'
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'verified'],
    default: 'not_started'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  hoursEstimated: {
    type: Number,
    default: 0
  },
  hoursCompleted: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date
  },
  targetDate: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TrainingAssignment', trainingAssignmentSchema);

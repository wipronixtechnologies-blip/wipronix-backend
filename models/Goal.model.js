const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  category: {
    type: String,
    enum: ['technical', 'professional', 'personal', 'project', 'learning'],
    default: 'professional'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  targetDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled'],
    default: 'not_started'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  milestones: [{
    title: String,
    description: String,
    targetDate: Date,
    isCompleted: { type: Boolean, default: false },
    completedAt: Date
  }],
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  assignedByName: {
    type: String
  },
  completedAt: {
    type: Date
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

const Goal = mongoose.model('Goal', goalSchema);

module.exports = Goal;

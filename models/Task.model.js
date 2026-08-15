const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  // Task Details
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  
  // Deadline
  deadline: {
    type: Date,
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'overdue'],
    default: 'pending'
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Completion details
  completedAt: {
    type: Date,
    default: null
  },
  
  // Notes/Comments
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for efficient queries
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ assignedBy: 1, createdAt: -1 });
taskSchema.index({ deadline: 1, status: 1 });

// Virtual to check if task is overdue
taskSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed') return false;
  return new Date() > new Date(this.deadline);
});

// Method to check overdue and update status
taskSchema.methods.checkOverdue = function() {
  if (this.status !== 'completed' && new Date() > new Date(this.deadline)) {
    this.status = 'overdue';
  }
  return this.status;
};

// Static method to get tasks by staff member
taskSchema.statics.getTasksByStaff = function(staffId, filters = {}) {
  const query = { assignedTo: staffId };
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  
  return this.find(query)
    .populate('assignedBy', 'fullName email designation')
    .sort({ createdAt: -1 });
};

// Static method to get tasks assigned by a manager
taskSchema.statics.getTasksByManager = function(managerId, filters = {}) {
  const query = { assignedBy: managerId };
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  
  return this.find(query)
    .populate('assignedTo', 'fullName email designation department')
    .sort({ createdAt: -1 });
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;


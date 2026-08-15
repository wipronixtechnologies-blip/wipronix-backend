const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['enrollment', 'completion', 'access', 'course', 'staff_added', 'staff_updated', 'staff_deleted', 'task_assigned', 'task_completed', 'ticket_created', 'ticket_resolved', 'attendance_punch_in', 'attendance_punch_out', 'leave_applied', 'leave_approved', 'leave_rejected', 'document_uploaded', 'request_actioned', 'policy_updated'],
    required: true
  },
  user: {
    type: String,
    required: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    index: true
  },
  actorRole: {
    type: String
  },
  action: {
    type: String,
    required: true
  },
  target: {
    type: String,
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  time: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

// Index for performance
activitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);

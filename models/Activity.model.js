const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    default: 'general',
    index: true
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
  actorName: {
    type: String
  },
  actorEmail: {
    type: String
  },
  actorRole: {
    type: String,
    index: true
  },
  actorDepartment: {
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
  targetModel: {
    type: String
  },
  time: {
    type: Date,
    default: Date.now,
    index: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  metadata: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

// Composite indexes for performance & auditing queries
activitySchema.index({ createdAt: -1 });
activitySchema.index({ actorId: 1, createdAt: -1 });
activitySchema.index({ category: 1, createdAt: -1 });
activitySchema.index({ time: -1 });

module.exports = mongoose.model('Activity', activitySchema);

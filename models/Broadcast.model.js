const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  type: {
    type: String,
    enum: ['holiday', 'party', 'announcement', 'urgent', 'maintenance', 'event'],
    default: 'announcement'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  targetAudience: {
    type: String,
    enum: ['all', 'students', 'staff', 'interns'],
    default: 'all'
  },
  createdBy: {
    type: String,
    required: true
  },
  createdByName: {
    type: String,
    required: true
  },
  createdByRole: {
    type: String,
    default: 'Admin'
  }
}, {
  timestamps: true
});

// Index for efficient queries
broadcastSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
broadcastSchema.index({ type: 1 });
broadcastSchema.index({ priority: 1 });

// Virtual to check if broadcast is currently active
broadcastSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive && 
         now >= this.startDate && 
         now <= this.endDate;
});

// Transform for JSON output
broadcastSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Broadcast = mongoose.model('Broadcast', broadcastSchema);

module.exports = Broadcast;


const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  }],
  participantNames: [{
    type: String
  }],
  participantImages: [{
    type: String
  }],
  conversationType: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  groupName: {
    type: String
  },
  groupImage: {
    type: String
  },
  lastMessage: {
    type: String
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  lastMessageBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;

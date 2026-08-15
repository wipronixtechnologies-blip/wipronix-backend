const Message = require('../../models/Message.model');
const Conversation = require('../../models/Conversation.model');
const Notification = require('../../models/Notification.model');
const { emitNewMessage, emitMessageRead } = require('../../src/services/socket');

// Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, content, messageType = 'text', fileUrl, fileName, fileSize } = req.body;
    
    console.log('[sendMessage] Request Body:', req.body);
    console.log('[sendMessage] Requester Staff:', req.staff ? `${req.staff._id} (${req.staff.fullName})` : 'Undefined');

    const senderId = req.staff.id || req.staff._id;
    const senderName = req.staff.fullName;
    const senderRole = req.staff.role;
    const senderImage = req.staff.profileImage;

    // Create conversation ID (sorted to ensure consistency)
    const conversationId = [senderId, recipientId].sort().join('_');

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
      conversationType: 'direct'
    });

    if (!conversation) {
      // Get recipient details
      const Staff = require('../../models/Staff.model');
      const recipient = await Staff.findById(recipientId);
      
      if (!recipient) {
         return res.status(404).json({ success: false, message: 'Recipient not found' });
      }

      conversation = new Conversation({
        participants: [senderId, recipientId],
        participantNames: [senderName, recipient.fullName],
        participantImages: [senderImage, recipient.profileImage],
        conversationType: 'direct'
      });
    }

    // Create message
    const message = new Message({
      conversationId,
      sender: senderId,
      senderName,
      senderRole,
      senderImage,
      recipient: recipientId,
      messageType,
      content,
      fileUrl,
      fileName,
      fileSize
    });

    await message.save();

    // Update conversation
    conversation.lastMessage = content;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = senderId;
    
    // Increment unread count for recipient
    if (!conversation.unreadCount) conversation.unreadCount = new Map();
    const currentCount = conversation.unreadCount.get(recipientId) || 0;
    conversation.unreadCount.set(recipientId, currentCount + 1);
    
    await conversation.save();

    // Create notification for recipient
    // Important: Notification type must match enum in Notification.model.js
    // Enum: ['message', 'broadcast', 'leave', 'task', 'attendance', 'performance', 'document', 'ticket', 'system']
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      senderName,
      type: 'message', 
      title: `New message from ${senderName}`,
      message: content.substring(0, 100),
      link: `/messages?conversation=${conversationId}`,
      priority: 'normal'
    });
    await notification.save();

    // Emit socket event
    emitNewMessage(recipientId, message.toJSON());

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Get conversation messages
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      conversationId,
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ conversationId, isDeleted: false });

    res.status(200).json({
      success: true,
      data: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
};

// Get all conversations for a user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.staff.id || req.staff._id;

    const conversations = await Conversation.find({
      participants: userId,
      isActive: true
    })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'fullName email profileImage role department');

    res.status(200).json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.staff.id || req.staff._id;

    // Update all unread messages in this conversation
    await Message.updateMany(
      {
        conversationId,
        recipient: userId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Reset unread count in conversation
    const conversation = await Conversation.findOne({
      participants: userId,
      $or: [
        { conversationType: 'direct' },
        { _id: conversationId }
      ]
    });

    if (conversation) {
      conversation.unreadCount.set(userId, 0);
      await conversation.save();
    }

    // Emit socket event
    emitMessageRead(conversationId, userId);

    res.status(200).json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.staff.id || req.staff._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can delete
    if (message.sender.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
};

// Get unread message count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.staff.id || req.staff._id;

    const count = await Message.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false
    });

    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message
    });
  }
};

// Admin: Get all conversations in the system
exports.getAllConversations = async (req, res) => {
  try {
    const { role, systemRole } = req.staff;
    if (role !== 'super_admin' && systemRole !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
    }

    const conversations = await Conversation.find({ isActive: true })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'fullName email profileImage role department designation');

    res.status(200).json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Error fetching all conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all conversations',
      error: error.message
    });
  }
};

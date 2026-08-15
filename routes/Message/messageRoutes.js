const express = require('express');
const router = express.Router();
const messageController = require('../../controllers/Message/messageController');
// Adjust path to Auth controller relative to this file
// routes/Message/messageRoutes.js -> routes/Message -> backend-wipronix -> controllers/Auth/staffProfile
const { authenticateStaff } = require('../../controllers/Auth/staffProfile');

console.log('[MessageRoutes] Loaded. Routes mounted.');

// Public test route
router.get('/ping', (req, res) => {
    console.log('[MessageRoutes] Ping received');
    res.json({ message: 'pong', status: 'active' });
});

// All message routes require authentication
router.use(authenticateStaff);

// Send a message
router.post('/send', (req, res, next) => {
    console.log('[MessageRoutes] POST /send hit');
    next();
}, messageController.sendMessage);

// Get conversations list (inbox)
router.get('/conversations', messageController.getConversations);

// Admin: Get all conversations
router.get('/admin/all-conversations', messageController.getAllConversations);

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', messageController.getMessages);

// Mark messages as read in a conversation
router.patch('/conversations/:conversationId/read', messageController.markAsRead);

// Get unread message count (for badges)
router.get('/unread-count', messageController.getUnreadCount);

// Delete a message (soft delete)
router.delete('/:messageId', messageController.deleteMessage);

module.exports = router;

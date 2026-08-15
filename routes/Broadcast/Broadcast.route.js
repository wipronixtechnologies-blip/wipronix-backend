const express = require('express');
const router = express.Router();
const broadcastController = require('../../controllers/Broadcast/Broadcast.controller');

// All routes require authentication (assumed middleware would be added)
// For now, we'll add routes without auth middleware for development

/**
 * @route   POST /api/broadcast
 * @desc    Create a new broadcast message
 * @access  Admin/Super Admin
 */
router.post('/', broadcastController.createBroadcast);

/**
 * @route   GET /api/broadcast
 * @desc    Get all broadcasts with pagination and filters
 * @access  Admin/Super Admin
 */
router.get('/', broadcastController.getAllBroadcasts);

/**
 * @route   GET /api/broadcast/active
 * @desc    Get all active broadcasts (for student portal)
 * @access  Public/All Users
 */
router.get('/active', broadcastController.getActiveBroadcasts);

/**
 * @route   GET /api/broadcast/stats
 * @desc    Get broadcast statistics
 * @access  Admin/Super Admin
 */
router.get('/stats', broadcastController.getBroadcastStats);

/**
 * @route   GET /api/broadcast/:id
 * @desc    Get single broadcast by ID
 * @access  Admin/Super Admin
 */
router.get('/:id', broadcastController.getBroadcastById);

/**
 * @route   PUT /api/broadcast/:id
 * @desc    Update broadcast by ID
 * @access  Admin/Super Admin
 */
router.put('/:id', broadcastController.updateBroadcast);

/**
 * @route   PATCH /api/broadcast/:id/toggle
 * @desc    Toggle broadcast active status
 * @access  Admin/Super Admin
 */
router.patch('/:id/toggle', broadcastController.toggleBroadcastStatus);

/**
 * @route   DELETE /api/broadcast/:id
 * @desc    Delete broadcast by ID
 * @access  Admin/Super Admin
 */
router.delete('/:id', broadcastController.deleteBroadcast);

module.exports = router;


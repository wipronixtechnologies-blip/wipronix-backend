const express = require('express');
const router = express.Router();
const notificationController = require('../../../controllers/Notification/notificationController');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

router.use(authenticateStaff);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.post('/:notificationId/read', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;

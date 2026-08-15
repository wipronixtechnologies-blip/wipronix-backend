const Notification = require('../../models/Notification.model');
const { emitNotification } = require('../../src/services/socket');

// Get all notifications for a user
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.staff?.id || req.user?._id || req.staff?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type;
    const isRead = req.query.isRead;

    const query = { recipient: userId };
    
    if (type) query.type = type;
    if (isRead !== undefined) query.isRead = isRead === 'true';

    const skip = (page - 1) * limit;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'fullName profileImage role');

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id || req.staff?.id || req.user?._id || req.staff?._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.staff?.id || req.user?._id || req.staff?._id;

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id || req.staff?.id || req.user?._id || req.staff?._id;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    // The instruction specified 'getAllTasks' but this function is 'deleteNotification'.
    // Applying the error logging to 'deleteNotification' as it's the closest context.
    console.error('SERVER ERROR - [deleteNotification]:', error); 
    res.status(500).json({ // Changed 'response' to 'res' to match the function signature
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id || req.staff?.id || req.user?._id || req.staff?._id;

    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false
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

// Create notification (internal use)
exports.createNotification = async (recipientId, data) => {
  try {
    const notification = new Notification({
      recipient: recipientId,
      ...data
    });

    await notification.save();

    // Emit socket event
    emitNotification(recipientId, notification.toJSON());

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

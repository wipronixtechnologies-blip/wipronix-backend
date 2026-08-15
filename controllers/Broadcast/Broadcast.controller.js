const Broadcast = require('../../models/Broadcast.model');
const { emitNewBroadcast, emitBroadcastUpdate, emitBroadcastDelete } = require('../../src/services/socket');

// Create a new broadcast message
exports.createBroadcast = async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      priority,
      startDate,
      endDate,
      targetAudience
    } = req.body;

    // Get admin info from auth middleware (assuming it's added to req.user)
    const createdBy = req.user?.id || 'system';
    const createdByName = req.user?.fullName || req.body.createdByName || 'Admin';
    const createdByRole = req.user?.role || req.body.createdByRole || 'Admin';

    const broadcast = new Broadcast({
      title,
      message,
      type: type || 'announcement',
      priority: priority || 'normal',
      startDate: startDate || new Date(),
      endDate,
      targetAudience: targetAudience || 'all',
      createdBy,
      createdByName,
      createdByRole
    });

    await broadcast.save();

    // Emit socket event for real-time notification
    emitNewBroadcast(broadcast.toJSON());

    res.status(201).json({
      success: true,
      message: 'Broadcast message created successfully',
      data: broadcast
    });
  } catch (error) {
    console.error('Error creating broadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create broadcast message',
      error: error.message
    });
  }
};

// Get all broadcasts with pagination and filters
exports.getAllBroadcasts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const type = req.query.type || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Status filter
    if (status === 'active') {
      const now = new Date();
      query.isActive = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'expired') {
      query.endDate = { $lt: new Date() };
    } else if (status === 'scheduled') {
      query.startDate = { $gt: new Date() };
    }

    const skip = (page - 1) * limit;

    const broadcasts = await Broadcast.find(query)
      .sort({ [sortBy]: sortOrder, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Broadcast.countDocuments(query);

    // Add computed status to each broadcast
    const broadcastsWithStatus = broadcasts.map(b => {
      const now = new Date();
      let status = 'active';
      if (!b.isActive) {
        status = 'inactive';
      } else if (now < b.startDate) {
        status = 'scheduled';
      } else if (now > b.endDate) {
        status = 'expired';
      }
      return {
        ...b.toJSON(),
        status
      };
    });

    res.status(200).json({
      success: true,
      data: broadcastsWithStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broadcasts',
      error: error.message
    });
  }
};

// Get all active broadcasts (for student portal)
exports.getActiveBroadcasts = async (req, res) => {
  try {
    const now = new Date();
    const targetAudience = req.query.targetAudience || 'all';

    const query = {
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    };

    // Filter by target audience if specified
    if (targetAudience !== 'all') {
      query.$or = [
        { targetAudience: 'all' },
        { targetAudience: targetAudience }
      ];
    }

    const broadcasts = await Broadcast.find(query)
      .sort({ priority: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: broadcasts
    });
  } catch (error) {
    console.error('Error fetching active broadcasts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active broadcasts',
      error: error.message
    });
  }
};

// Get single broadcast by ID
exports.getBroadcastById = async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);

    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    res.status(200).json({
      success: true,
      data: broadcast
    });
  } catch (error) {
    console.error('Error fetching broadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broadcast',
      error: error.message
    });
  }
};

// Update broadcast by ID
exports.updateBroadcast = async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      priority,
      startDate,
      endDate,
      isActive,
      targetAudience,
      createdByRole
    } = req.body;

    const broadcast = await Broadcast.findByIdAndUpdate(
      req.params.id,
      {
        title,
        message,
        type,
        priority,
        startDate,
        endDate,
        isActive,
        targetAudience,
        createdByRole
      },
      { new: true, runValidators: true }
    );

    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Emit socket event for real-time update
    emitBroadcastUpdate(broadcast.toJSON());

    res.status(200).json({
      success: true,
      message: 'Broadcast updated successfully',
      data: broadcast
    });
  } catch (error) {
    console.error('Error updating broadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update broadcast',
      error: error.message
    });
  }
};

// Toggle broadcast active status
exports.toggleBroadcastStatus = async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);

    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    broadcast.isActive = !broadcast.isActive;
    await broadcast.save();

    res.status(200).json({
      success: true,
      message: `Broadcast ${broadcast.isActive ? 'activated' : 'deactivated'} successfully`,
      data: broadcast
    });
  } catch (error) {
    console.error('Error toggling broadcast status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle broadcast status',
      error: error.message
    });
  }
};

// Delete broadcast by ID
exports.deleteBroadcast = async (req, res) => {
  try {
    const broadcast = await Broadcast.findByIdAndDelete(req.params.id);

    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Emit socket event for real-time deletion
    emitBroadcastDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Broadcast deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting broadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete broadcast',
      error: error.message
    });
  }
};

// Get broadcast statistics
exports.getBroadcastStats = async (req, res) => {
  try {
    const now = new Date();

    const [
      totalBroadcasts,
      activeBroadcasts,
      expiredBroadcasts,
      scheduledBroadcasts,
      broadcastsByType,
      broadcastsByPriority
    ] = await Promise.all([
      Broadcast.countDocuments(),
      Broadcast.countDocuments({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      }),
      Broadcast.countDocuments({
        endDate: { $lt: now }
      }),
      Broadcast.countDocuments({
        startDate: { $gt: now }
      }),
      Broadcast.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      Broadcast.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalBroadcasts,
        active: activeBroadcasts,
        expired: expiredBroadcasts,
        scheduled: scheduledBroadcasts,
        byType: broadcastsByType,
        byPriority: broadcastsByPriority
      }
    });
  } catch (error) {
    console.error('Error fetching broadcast stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broadcast statistics',
      error: error.message
    });
  }
};


const Activity = require('../../models/Activity.model');
const Staff = require('../../models/Staff.model');
const { escapeRegex } = require('../../utils/regexUtils');

// Helper to log activities system-wide
exports.logActivity = async (data) => {
  try {
    let actorName = data.actorName || data.user;
    let actorEmail = data.actorEmail;
    let actorRole = data.actorRole;
    let actorDepartment = data.actorDepartment;

    // If actorId provided but name/role not fully given, fetch staff details
    if (data.actorId && (!actorName || !actorRole)) {
      try {
        const staff = await Staff.findById(data.actorId).select('fullName email role department').lean();
        if (staff) {
          actorName = staff.fullName || actorName;
          actorEmail = staff.email || actorEmail;
          actorRole = staff.role || actorRole;
          actorDepartment = staff.department || actorDepartment;
        }
      } catch (e) {
        // Continue even if lookup fails
      }
    }

    const activity = new Activity({
      type: data.type || 'general',
      category: data.category || 'general',
      user: actorName || 'System',
      actorId: data.actorId,
      actorName: actorName || data.user,
      actorEmail: actorEmail,
      actorRole: actorRole,
      actorDepartment: actorDepartment,
      action: data.action,
      target: data.target || 'General',
      targetId: data.targetId,
      targetModel: data.targetModel,
      time: data.time || new Date(),
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata || {}
    });

    await activity.save();
    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// Fetch recent activities (Dashboard feed)
exports.getRecentActivities = async (req, res) => {
  try {
    const userRole = req.staff.role;
    const userId = req.staff._id;
    
    let query = {};
    
    // If not super_admin or admin, filter activities relevant to the user
    if (!['super_admin', 'admin'].includes(userRole)) {
       query = {
           $or: [
               { actorId: userId },
               { targetId: userId }
           ]
       };
    }

    const activities = await Activity.find(query)
      .populate('actorId', 'fullName firstName lastName email role department profileImage')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
      
    res.status(200).json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities',
      error: error.message
    });
  }
};

// Super Admin: Comprehensive Staff Audit Logs with Search, Category, Date & Staff Filters
exports.getAllStaffLogs = async (req, res) => {
  try {
    const userRole = req.staff?.role;
    const isPrivileged = ['super_admin', 'admin', 'hr', 'hr_manager'].includes(userRole);

    const {
      staffId,
      category,
      type,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 25
    } = req.query;

    const query = {};

    // Restrict non-privileged users to their own logs
    if (!isPrivileged) {
      query.actorId = req.staff._id;
    } else if (staffId && staffId !== 'all') {
      query.actorId = staffId;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        query.createdAt.$lte = end;
      }
    }

    // Search query across action, target, user, notes
    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { action: searchRegex },
        { target: searchRegex },
        { user: searchRegex },
        { actorName: searchRegex },
        { actorEmail: searchRegex },
        { 'metadata.notes': searchRegex },
        { 'metadata.callOutcome': searchRegex },
        { 'metadata.technology': searchRegex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, totalCount] = await Promise.all([
      Activity.find(query)
        .populate('actorId', 'fullName firstName lastName email role department designation profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Activity.countDocuments(query)
    ]);

    // Calculate live metrics for Super Admin dashboard overview
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayCount, distinctActiveStaff] = await Promise.all([
      Activity.countDocuments({ createdAt: { $gte: todayStart } }),
      Activity.distinct('actorId', { createdAt: { $gte: todayStart }, actorId: { $ne: null } })
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          totalCount,
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          limit: limitNum
        },
        metrics: {
          totalLogs: totalCount,
          todayLogs: todayCount,
          activeStaffToday: distinctActiveStaff.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching staff logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff activity logs',
      error: error.message
    });
  }
};

// Super Admin: Aggregated Activity Summary Per Staff Member
exports.getStaffActivitySummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const timeMatch = {};
    if (startDate || endDate) {
      timeMatch.createdAt = {};
      if (startDate) timeMatch.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) end.setHours(23, 59, 59, 999);
        timeMatch.createdAt.$lte = end;
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const aggregation = await Activity.aggregate([
      { $match: { actorId: { $ne: null }, ...timeMatch } },
      {
        $group: {
          _id: '$actorId',
          totalActions: { $sum: 1 },
          todayActions: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', todayStart] }, 1, 0]
            }
          },
          lastActivityTime: { $max: '$createdAt' },
          lastAction: { $last: '$action' },
          lastTarget: { $last: '$target' },
          categories: { $addToSet: '$category' }
        }
      },
      {
        $lookup: {
          from: 'staffs',
          localField: '_id',
          foreignField: '_id',
          as: 'staffDetails'
        }
      },
      { $unwind: { path: '$staffDetails', preserveNullAndEmptyArrays: true } },
      { $sort: { todayActions: -1, lastActivityTime: -1 } }
    ]);

    const formatted = aggregation.map(item => ({
      staffId: item._id,
      fullName: item.staffDetails?.fullName || `${item.staffDetails?.firstName || ''} ${item.staffDetails?.lastName || ''}`.trim() || 'Staff Member',
      email: item.staffDetails?.email || '',
      role: item.staffDetails?.role || '',
      department: item.staffDetails?.department || '',
      designation: item.staffDetails?.designation || '',
      profileImage: item.staffDetails?.profileImage,
      totalActions: item.totalActions,
      todayActions: item.todayActions,
      lastActivityTime: item.lastActivityTime,
      lastAction: item.lastAction,
      lastTarget: item.lastTarget,
      categories: item.categories
    }));

    res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching staff activity summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff activity summary',
      error: error.message
    });
  }
};

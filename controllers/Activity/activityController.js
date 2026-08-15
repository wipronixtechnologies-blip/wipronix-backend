const Activity = require('../../models/Activity.model');

// Helper to log activities
exports.logActivity = async (data) => {
  try {
    const activity = new Activity(data);
    await activity.save();
    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// Fetch recent activities
exports.getRecentActivities = async (req, res) => {
  try {
    const userRole = req.staff.role;
    const userId = req.staff._id;
    
    let query = {};
    
    // If not admin, filter activities relevant to the user
    if (!['super_admin', 'admin'].includes(userRole)) {
       // Filter by actorId (actions perform by user) or targetId (actions on user)
       // Fallback: If no IDs, maybe match by name? Unreliable. better to show nothing than wrong data.
       // Or show generally public events like 'course_added'?
       // For now, strict personal feed.
       query = {
           $or: [
               { actorId: userId },
               { targetId: userId }
           ]
       };
    }

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(10);
      
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

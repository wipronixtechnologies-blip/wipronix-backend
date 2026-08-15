const Staff = require('../../models/Staff.model');
const Student = require('../../models/Student.model');
const College = require('../../models/College.model');
const Task = require('../../models/Task.model');

// Get organization-wide statistics
exports.getStaffStats = async (req, res) => {
  try {
    // 1. Staff Stats
    const totalStaff = await Staff.countDocuments();
    const activeStaff = await Staff.countDocuments({ isActive: true });
    
    // 2. Student Stats
    const totalStudents = await Student.countDocuments();
    
    // 3. College Stats
    const totalColleges = await College.countDocuments();
    
    // 4. Task Stats
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: 'completed' });
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // 5. Aggregations
    const byRole = await Staff.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const byDepartment = await Staff.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        staff: {
          total: totalStaff,
          active: activeStaff,
          byRole,
          byDepartment
        },
        students: {
          total: totalStudents
        },
        colleges: {
          total: totalColleges
        },
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          completionRate: taskCompletionRate
        },
        // Legacy fields for backward compatibility if any
        total: totalStaff,
        active: activeStaff
      }
    });
  } catch (error) {
    console.error('Error fetching organization statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};


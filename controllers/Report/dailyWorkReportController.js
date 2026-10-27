const DailyWorkReport = require('../../models/DailyWorkReport.model');
const Staff = require('../../models/Staff.model');
const Attendance = require('../../models/Attendance.model');

// Helper to get current Date string in YYYY-MM-DD format in IST
const getTodayDateIST = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

// 1. Submit or update today's daily work report
exports.submitDailyWorkReport = async (req, res) => {
  try {
    const staffId = req.staff._id;
    const {
      date = getTodayDateIST(),
      title,
      tasksSummary,
      challengesBlockers,
      planForTomorrow,
      hoursWorked,
      workLinks
    } = req.body;

    if (!tasksSummary || !tasksSummary.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tasks summary is required for daily report submission'
      });
    }

    // Total hours is calculated automatically from Attendance punch-in/out and cannot be edited
    let resolvedHours = 0;
    try {
      const attendance = await Attendance.findOne({ staffId, date });
      if (attendance) {
        if (attendance.totalHours > 0) {
          resolvedHours = attendance.totalHours;
        } else if (attendance.punchInTime) {
          const inTime = new Date(attendance.punchInTime).getTime();
          const outTime = attendance.punchOutTime ? new Date(attendance.punchOutTime).getTime() : Date.now();
          const diffMs = outTime - inTime;
          if (diffMs > 0) {
            resolvedHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
          }
        }
      }
    } catch (attErr) {
      console.warn('Attendance lookup for daily report error:', attErr.message);
    }

    const reportData = {
      staff: staffId,
      date,
      title: title || 'Daily Work Report',
      tasksSummary: tasksSummary.trim(),
      challengesBlockers: (challengesBlockers || '').trim(),
      planForTomorrow: (planForTomorrow || '').trim(),
      hoursWorked: resolvedHours > 0 ? resolvedHours : (Number(hoursWorked) || 0),
      workLinks: (workLinks || '').trim(),
      status: 'pending' // Re-submitting sets status back to pending approval
    };

    const report = await DailyWorkReport.findOneAndUpdate(
      { staff: staffId, date },
      reportData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('staff', 'fullName email department designation role');

    return res.status(200).json({
      success: true,
      message: 'Daily report submitted successfully. Awaiting Super Admin approval.',
      data: report
    });
  } catch (error) {
    console.error('Submit daily report error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while submitting daily report'
    });
  }
};

// 2. Get my daily work reports
exports.getMyDailyWorkReports = async (req, res) => {
  try {
    const staffId = req.staff._id;
    const { month, year, date } = req.query;

    const query = { staff: staffId };

    if (date) {
      query.date = date;
    } else if (month && year) {
      const formattedMonth = String(month).padStart(2, '0');
      query.date = { $regex: `^${year}-${formattedMonth}` };
    }

    const reports = await DailyWorkReport.find(query)
      .populate('reviewedBy', 'fullName email')
      .sort({ date: -1 });

    return res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Get my daily reports error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch your daily reports'
    });
  }
};

// 3. Get today's report for the logged in staff
exports.getTodayDailyWorkReport = async (req, res) => {
  try {
    const userRole = req.staff.role || req.staff.systemRole;
    let staffId = req.staff._id;
    if (req.query.staffId && ['super_admin', 'superadmin', 'admin', 'tl'].includes(userRole)) {
      staffId = req.query.staffId;
    }
    const date = req.query.date || getTodayDateIST();

    const report = await DailyWorkReport.findOne({ staff: staffId, date })
      .populate('reviewedBy', 'fullName email');

    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get today report error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch today report'
    });
  }
};

// 4. Get all daily work reports (Super Admin / Admin / TL view)
exports.getAllDailyWorkReports = async (req, res) => {
  try {
    const userRole = (req.staff.role || req.staff.systemRole || '').toLowerCase();
    if (!['super_admin', 'superadmin', 'admin', 'tl'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrative privileges required.'
      });
    }

    const { date, status, department, staffId, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (date && date !== 'all') {
      query.date = date;
    }
    if (status && status !== 'all') {
      query.status = status;
    }
    if (staffId && staffId !== 'all') {
      query.staff = staffId;
    }

    if (department && department !== 'all') {
      const matchingStaff = await Staff.find({
        department: { $regex: new RegExp(`^${department.trim()}$`, 'i') }
      }).select('_id');
      const staffIds = matchingStaff.map(s => s._id);
      if (query.staff) {
        if (!staffIds.map(String).includes(String(query.staff))) {
          return res.status(200).json({
            success: true,
            data: [],
            pagination: { page: 1, limit: parseInt(limit, 10), total: 0, pages: 0 }
          });
        }
      } else {
        query.staff = { $in: staffIds };
      }
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingStaff = await Staff.find({
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { designation: searchRegex },
          { department: searchRegex }
        ]
      }).select('_id');
      const searchStaffIds = matchingStaff.map(s => s._id);

      query.$or = [
        { tasksSummary: searchRegex },
        { challengesBlockers: searchRegex },
        { planForTomorrow: searchRegex },
        { staff: { $in: searchStaffIds } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const reports = await DailyWorkReport.find(query)
      .populate('staff', 'fullName email department designation role')
      .populate('reviewedBy', 'fullName email')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await DailyWorkReport.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('Get all daily reports error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch daily reports'
    });
  }
};

// 5. Review daily work report (Approve / Reject by Super Admin / Admin)
exports.reviewDailyWorkReport = async (req, res) => {
  try {
    const userRole = (req.staff.role || req.staff.systemRole || '').toLowerCase();
    if (!['super_admin', 'superadmin', 'admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Super Admin or Admin can approve daily reports.'
      });
    }

    const { id } = req.params;
    const { status, reviewRemarks } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (approved or rejected) is required'
      });
    }

    const report = await DailyWorkReport.findByIdAndUpdate(
      id,
      {
        status,
        reviewedBy: req.staff._id,
        reviewedAt: new Date(),
        reviewRemarks: (reviewRemarks || '').trim()
      },
      { new: true }
    ).populate('staff', 'fullName email department designation role')
     .populate('reviewedBy', 'fullName email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Daily report not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Daily report ${status} successfully`,
      data: report
    });
  } catch (error) {
    console.error('Review daily report error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to review daily report'
    });
  }
};

// 6. Bulk Review Daily Work Reports
exports.bulkReviewDailyWorkReports = async (req, res) => {
  try {
    const userRole = (req.staff.role || req.staff.systemRole || '').toLowerCase();
    if (!['super_admin', 'superadmin', 'admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Super Admin or Admin can approve daily reports.'
      });
    }

    const { ids, status, reviewRemarks } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of report IDs to review.'
      });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (approved or rejected) is required'
      });
    }

    const result = await DailyWorkReport.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status,
          reviewedBy: req.staff._id,
          reviewedAt: new Date(),
          reviewRemarks: (reviewRemarks || '').trim()
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} daily reports to ${status}`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk review daily reports error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to bulk review daily reports'
    });
  }
};


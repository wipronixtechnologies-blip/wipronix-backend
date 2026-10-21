const DailyWorkReport = require('../../models/DailyWorkReport.model');
const Staff = require('../../models/Staff.model');

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

    const reportData = {
      staff: staffId,
      date,
      title: title || 'Daily Work Report',
      tasksSummary: tasksSummary.trim(),
      challengesBlockers: (challengesBlockers || '').trim(),
      planForTomorrow: (planForTomorrow || '').trim(),
      hoursWorked: Number(hoursWorked) || 8,
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
    const staffId = req.staff._id;
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
    const userRole = req.staff.role || req.staff.systemRole;
    if (!['super_admin', 'admin', 'tl'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrative privileges required.'
      });
    }

    const { date, status, department, staffId, page = 1, limit = 20 } = req.query;
    const query = {};

    if (date) query.date = date;
    if (status) query.status = status;
    if (staffId) query.staff = staffId;

    if (department) {
      const matchingStaff = await Staff.find({ department }).select('_id');
      query.staff = { $in: matchingStaff.map(s => s._id) };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const reports = await DailyWorkReport.find(query)
      .populate('staff', 'fullName email department designation role')
      .populate('reviewedBy', 'fullName email')
      .sort({ createdAt: -1 })
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
    const userRole = req.staff.role || req.staff.systemRole;
    if (!['super_admin', 'admin'].includes(userRole)) {
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

const Attendance = require('../../models/Attendance.model');
const Staff = require('../../models/Staff.model');
const Activity = require('../../models/Activity.model');

// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
};

// Validate location (within 100 meters of office location)
const validateLocation = (userLat, userLng) => {
  const OFFICE_LAT = 30.6970439;
  const OFFICE_LNG = 76.68684;
  const MAX_DISTANCE_KM = 0.1; // 100 meters

  const distance = calculateDistance(userLat, userLng, OFFICE_LAT, OFFICE_LNG);
  return distance <= MAX_DISTANCE_KM;
};

// Constants for attendance time thresholds
const PUNCH_IN_LATE_THRESHOLD_HOUR = 9;
const PUNCH_IN_LATE_THRESHOLD_MINUTE = 10; // 9:10 AM
const PUNCH_OUT_EARLY_THRESHOLD_HOUR = 18;
const PUNCH_OUT_EARLY_THRESHOLD_MINUTE = 0; // 6:00 PM
const HALF_DAY_THRESHOLD_HOUR = 13;
const HALF_DAY_THRESHOLD_MINUTE = 30; // 1:30 PM

// Check if current time is after half-day threshold
const isAfterHalfDayThreshold = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  return currentHour > HALF_DAY_THRESHOLD_HOUR || 
         (currentHour === HALF_DAY_THRESHOLD_HOUR && currentMinute >= HALF_DAY_THRESHOLD_MINUTE);
};

// Determine status based on punch-in time
const getStatusFromPunchInTime = (punchInTime) => {
  const punchInDate = new Date(punchInTime);
  const punchInHour = punchInDate.getHours();
  const punchInMinute = punchInDate.getMinutes();

  // Check if punch-in is after 9:10 AM
  if (punchInHour > PUNCH_IN_LATE_THRESHOLD_HOUR || 
      (punchInHour === PUNCH_IN_LATE_THRESHOLD_HOUR && 
       punchInMinute >= PUNCH_IN_LATE_THRESHOLD_MINUTE)) {
    return 'short_leave';
  }

  return 'present';
};

// Determine or update status based on punch-out time
const getStatusFromPunchOutTime = (currentStatus, punchOutTime, reasonType = null) => {
  const punchOutDate = new Date(punchOutTime);
  const punchOutHour = punchOutDate.getHours();
  const punchOutMinute = punchOutDate.getMinutes();

  // If reason type is provided (half_day or other), handle accordingly
  if (reasonType === 'half_day') {
    return 'half_day';
  }
  
  if (reasonType === 'other') {
    return 'pending_other';
  }

  // Check if punch-out is before 6:00 PM
  if (punchOutHour < PUNCH_OUT_EARLY_THRESHOLD_HOUR || 
      (punchOutHour === PUNCH_OUT_EARLY_THRESHOLD_HOUR && 
       punchOutMinute < PUNCH_OUT_EARLY_THRESHOLD_MINUTE)) {
    return 'short_leave';
  }

  // If punch-out is on/after 6:00 PM and current status is already short_leave 
  // (due to late punch-in), keep it as short_leave
  if (currentStatus === 'short_leave') {
    return 'short_leave';
  }

  return 'present';
};

// Punch In
const punchIn = async (request, response) => {
  try {
    // const { latitude, longitude } = request.body;
    const latitude = "30.6970439"
    const longitude="76.68684"

    // Validate required fields
    if (!latitude || !longitude) {
      return response.status(400).json({
        success: false,
        message: 'Location coordinates are required'
      });
    }

    // Validate location
    if (!validateLocation(latitude, longitude)) {
      return response.status(403).json({
        success: false,
        message: 'You must be at the office location to punch in'
      });
    }

    const staffId = request.staff._id;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Check if already punched in today
    const existingAttendance = await Attendance.findOne({
      staffId,
      date: today
    });

    if (existingAttendance) {
      return response.status(400).json({
        success: false,
        message: 'You have already punched in today'
      });
    }

    // Determine status based on punch-in time
    const currentTime = new Date();
    const status = getStatusFromPunchInTime(currentTime);

    // Create new attendance record
    const attendance = new Attendance({
      staffId,
      date: today,
      punchInTime: currentTime,
      punchInLocation: {
        latitude,
        longitude
      },
      status: status
    });

    await attendance.save();

    // Log Activity
    await Activity.create({
        type: 'attendance_punch_in',
        user: request.staff.fullName,
        actorId: staffId,
        action: 'punched in',
        target: 'Work Dashboard',
        targetId: attendance._id
    });

    // Populate staff information
    await attendance.populate('staffId', 'fullName email department designation');

    response.status(201).json({
      success: true,
      message: 'Punched in successfully',
      attendance: {
        id: attendance._id,
        date: attendance.date,
        punchInTime: attendance.punchInTime,
        status: attendance.status,
        staff: attendance.staffId
      }
    });

  } catch (error) {
    console.error('Punch in error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Punch Out
const punchOut = async (request, response) => {
  try {
    // const { latitude, longitude, reason, reasonType } = request.body;
    const latitude = "30.6970439"
    const longitude="76.68684"
    const reason = request.body.reason || null;
    const reasonType = request.body.reasonType || null;

    // Validate required fields
    if (!latitude || !longitude) {
      return response.status(400).json({
        success: false,
        message: 'Location coordinates are required'
      });
    }

    // Validate reason if reasonType is provided
    if (reasonType && reasonType === 'other' && !reason) {
      return response.status(400).json({
        success: false,
        message: 'Please provide a reason for early departure'
      });
    }

    // Validate half-day threshold
    if (reasonType && reasonType === 'half_day' && !isAfterHalfDayThreshold()) {
      return response.status(400).json({
        success: false,
        message: 'Half day can only be applied after 1:30 PM'
      });
    }

    // Validate location
    if (!validateLocation(latitude, longitude)) {
      return response.status(403).json({
        success: false,
        message: 'You must be at the office location to punch out'
      });
    }

    const staffId = request.staff._id;
    const today = new Date().toISOString().split('T')[0];

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      staffId,
      date: today
    });

    if (!attendance) {
      return response.status(400).json({
        success: false,
        message: 'No punch in record found for today'
      });
    }

    if (attendance.punchOutTime) {
      return response.status(400).json({
        success: false,
        message: 'You have already punched out today'
      });
    }

    // Update punch out details
    const punchOutTime = new Date();
    attendance.punchOutTime = punchOutTime;
    attendance.punchOutLocation = {
      latitude,
      longitude
    };

    // Set reason details
    if (reasonType) {
      attendance.punchOutReasonType = reasonType;
      attendance.punchOutReason = reason;
      
      // Set approval status based on reason type
      if (reasonType === 'half_day') {
        // Half day is auto-approved if after threshold
        attendance.punchOutApprovalStatus = 'approved';
      } else if (reasonType === 'other') {
        // Other reasons require admin approval
        attendance.punchOutApprovalStatus = 'pending';
      }
    }

    // Update status based on punch-out time and reason
    attendance.status = getStatusFromPunchOutTime(attendance.status, punchOutTime, reasonType);

    // Calculate total hours
    attendance.calculateTotalHours();

    await attendance.save();

    // Log Activity
    await Activity.create({
        type: 'attendance_punch_out',
        user: request.staff.fullName,
        actorId: staffId,
        action: 'punched out',
        target: 'Work Session',
        targetId: attendance._id,
        metadata: { totalHours: attendance.totalHours }
    });

    // Populate staff information
    await attendance.populate('staffId', 'fullName email department designation');

    response.status(200).json({
      success: true,
      message: reasonType === 'other' 
        ? 'Punch out submitted for admin approval' 
        : 'Punched out successfully',
      attendance: {
        id: attendance._id,
        date: attendance.date,
        punchInTime: attendance.punchInTime,
        punchOutTime: attendance.punchOutTime,
        totalHours: attendance.totalHours,
        status: attendance.status,
        punchOutReason: attendance.punchOutReason,
        punchOutReasonType: attendance.punchOutReasonType,
        punchOutApprovalStatus: attendance.punchOutApprovalStatus,
        staff: attendance.staffId
      }
    });

  } catch (error) {
    console.error('Punch out error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get Attendance by Staff
const getAttendanceByStaff = async (request, response) => {
  try {
    const staffId = request.staff._id;
    const { page = 1, limit = 10, startDate, endDate, month, year } = request.query;

    let query = { staffId, isActive: true };

    // Filter by date range
    if (startDate && endDate) {
      query.date = {
        $gte: startDate,
        $lte: endDate
      };
    } else if (month && year) {
      // Filter by specific month and year
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      query.date = {
        $gte: startOfMonth.toISOString().split('T')[0],
        $lte: endOfMonth.toISOString().split('T')[0]
      };
    }

    // Get total count for pagination
    const totalRecords = await Attendance.countDocuments(query);

    // Get attendance records with pagination
    const attendances = await Attendance.find(query)
      .populate('staffId', 'fullName email department designation')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Calculate summary statistics
    const totalDays = attendances.length;
    const presentDays = attendances.filter(a => a.status === 'present').length;
    const totalHours = attendances.reduce((sum, a) => sum + (a.totalHours || 0), 0);

    response.status(200).json({
      success: true,
      data: {
        attendances: attendances.map(attendance => ({
          id: attendance._id,
          date: attendance.date,
          formattedDate: attendance.formattedDate,
          punchInTime: attendance.punchInTime,
          formattedPunchInTime: attendance.formattedPunchInTime,
          punchOutTime: attendance.punchOutTime,
          formattedPunchOutTime: attendance.formattedPunchOutTime,
          totalHours: attendance.totalHours,
          status: attendance.status,
          punchInLocation: attendance.punchInLocation,
          punchOutLocation: attendance.punchOutLocation,
          punchOutReason: attendance.punchOutReason,
          punchOutReasonType: attendance.punchOutReasonType,
          punchOutApprovalStatus: attendance.punchOutApprovalStatus,
          notes: attendance.notes
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRecords / limit),
          totalRecords,
          hasNext: page * limit < totalRecords,
          hasPrev: page > 1
        },
        summary: {
          totalDays,
          presentDays,
          absentDays: totalDays - presentDays,
          totalHours: Math.round(totalHours * 100) / 100
        }
      }
    });

  } catch (error) {
    console.error('Get attendance by staff error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get Current Attendance Status
const getCurrentStatus = async (request, response) => {
  try {
    const staffId = request.staff._id;
    const today = new Date().toISOString().split('T')[0];

    const attendance = await Attendance.findOne({
      staffId,
      date: today
    });

    let status = 'off_duty';
    let punchInTime = null;
    let totalHours = 0;
    let canApplyHalfDay = false;
    let punchOutTime = null;
    let hasPunchOut = false;

    if (attendance) {
      hasPunchOut = !!attendance.punchOutTime;
      if (attendance.punchOutTime) {
        status = 'completed';
        totalHours = attendance.totalHours;
        punchOutTime = attendance.punchOutTime;
      } else {
        status = 'on_duty';
        // Check if user can apply for half day
        canApplyHalfDay = isAfterHalfDayThreshold();
      }
      punchInTime = attendance.punchInTime;
    }

    response.status(200).json({
      success: true,
      data: {
        status,
        punchInTime,
        punchOutTime,
        totalHours,
        canApplyHalfDay,
        hasPunchOut,
        date: today
      }
    });

  } catch (error) {
    console.error('Get current status error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get All Staff Attendance (Admin only)
const getAllStaffAttendance = async (request, response) => {
  try {
    const { role } = request.staff;
    if (!['super_admin', 'admin', 'hr'].includes(role)) {
      return response.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    const { page = 1, limit = 10, startDate, endDate, month, year, staffId, department } = request.query;

    let query = { isActive: true };

    if (staffId) query.staffId = staffId;
    
    // Filter by department if provided
    if (department) {
       const staffInDept = await Staff.find({ department, isActive: true }).select('_id');
       const staffIds = staffInDept.map(s => s._id);
       query.staffId = { $in: staffIds };
    }

    // Filter by date range
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      query.date = {
        $gte: startOfMonth.toISOString().split('T')[0],
        $lte: endOfMonth.toISOString().split('T')[0]
      };
    } else if (request.query.date) {
        query.date = request.query.date;
    }

    const totalRecords = await Attendance.countDocuments(query);

    const attendances = await Attendance.find(query)
      .populate('staffId', 'fullName email department designation role')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    response.status(200).json({
      success: true,
      data: {
        attendances: attendances.map(attendance => ({
          id: attendance._id,
          date: attendance.date,
          formattedDate: attendance.formattedDate,
          punchInTime: attendance.punchInTime,
          formattedPunchInTime: attendance.formattedPunchInTime,
          punchOutTime: attendance.punchOutTime,
          formattedPunchOutTime: attendance.formattedPunchOutTime,
          totalHours: attendance.totalHours,
          status: attendance.status,
          punchInLocation: attendance.punchInLocation,
          punchOutLocation: attendance.punchOutLocation,
          notes: attendance.notes,
          staff: attendance.staffId
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRecords / limit),
          totalRecords,
          hasNext: page * limit < totalRecords,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get all staff attendance error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  punchIn,
  punchOut,
  getAttendanceByStaff,
  getCurrentStatus,
  getAllStaffAttendance
};

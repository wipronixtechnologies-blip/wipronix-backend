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

// Timezone configuration
const TIMEZONE = 'Asia/Kolkata';

// Helper to get current Date string in YYYY-MM-DD format in IST
const getTodayDateIST = (dateObj = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
};

// Helper to get hours and minutes in IST from a Date object
const getISTTimeParts = (dateObj = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(dateObj);
  let hour = 0;
  let minute = 0;
  
  for (const part of parts) {
    if (part.type === 'hour') {
      hour = parseInt(part.value, 10);
    } else if (part.type === 'minute') {
      minute = parseInt(part.value, 10);
    }
  }
  
  if (hour === 24) hour = 0;
  
  return { hour, minute };
};

// Constants for attendance time thresholds (in IST)
const PUNCH_IN_SHORT_LEAVE_THRESHOLD_HOUR = 9;
const PUNCH_IN_SHORT_LEAVE_THRESHOLD_MINUTE = 40; // 9:40 AM IST
const PUNCH_IN_HALF_DAY_THRESHOLD_HOUR = 11;
const PUNCH_IN_HALF_DAY_THRESHOLD_MINUTE = 30; // 11:30 AM IST
const PUNCH_OUT_SHORT_LEAVE_START_HOUR = 16;
const PUNCH_OUT_SHORT_LEAVE_START_MINUTE = 30; // 4:30 PM IST
const PUNCH_OUT_SHIFT_END_HOUR = 18;
const PUNCH_OUT_SHIFT_END_MINUTE = 30; // 6:30 PM IST
const HALF_DAY_THRESHOLD_HOUR = 13;
const HALF_DAY_THRESHOLD_MINUTE = 30; // 1:30 PM IST

// Check if current time is after half-day threshold (in IST)
const isAfterHalfDayThreshold = (dateObj = new Date()) => {
  const { hour: currentHour, minute: currentMinute } = getISTTimeParts(dateObj);
  
  return currentHour > HALF_DAY_THRESHOLD_HOUR || 
         (currentHour === HALF_DAY_THRESHOLD_HOUR && currentMinute >= HALF_DAY_THRESHOLD_MINUTE);
};

// Determine status based on punch-in time (in IST)
// Rule:
// - On or before 09:40 AM: 'present'
// - Between 09:40 AM and 11:30 AM: 'short_leave'
// - After 11:30 AM: 'half_day'
const getStatusFromPunchInTime = (punchInTime) => {
  const punchInDate = new Date(punchInTime);
  const { hour: punchInHour, minute: punchInMinute } = getISTTimeParts(punchInDate);
  const punchMinutes = punchInHour * 60 + punchInMinute;

  const shortLeaveMinutes = 9 * 60 + 40; // 09:40 AM (580 min)
  const halfDayMinutes = 11 * 60 + 30;   // 11:30 AM (690 min)

  if (punchMinutes > halfDayMinutes) {
    return 'half_day';
  } else if (punchMinutes > shortLeaveMinutes) {
    return 'short_leave';
  }

  return 'present';
};

// Determine or update status based on punch-out time (in IST)
// Rule:
// - If reasonType is 'half_day': 'half_day'
// - If reasonType is 'other': 'pending_other'
// - If currentStatus is already 'half_day': remains 'half_day'
// - If punch-out is between 04:30 PM and 06:30 PM IST: 'short_leave'
// - If punch-out is before 04:30 PM IST: 'half_day'
// - If punch-out is on or after 06:30 PM IST: keep 'short_leave' if already marked, otherwise 'present'
const getStatusFromPunchOutTime = (currentStatus, punchOutTime, reasonType = null) => {
  const punchOutDate = new Date(punchOutTime);
  const { hour: punchOutHour, minute: punchOutMinute } = getISTTimeParts(punchOutDate);
  const punchOutMinutes = punchOutHour * 60 + punchOutMinute;

  // If reason type is provided (half_day or other), handle accordingly
  if (reasonType === 'half_day') {
    return 'half_day';
  }
  
  if (reasonType === 'other') {
    return 'pending_other';
  }

  // If already half day (e.g. came after 11:30 AM), maintain half_day
  if (currentStatus === 'half_day') {
    return 'half_day';
  }

  const shortLeaveStartMin = 16 * 60 + 30; // 04:30 PM (990 min)
  const shiftEndMin = 18 * 60 + 30;        // 06:30 PM (1110 min)

  // Check if punch-out is before 04:30 PM IST -> Half Day
  if (punchOutMinutes < shortLeaveStartMin) {
    return 'half_day';
  }

  // Check if punch-out is in between 04:30 PM and 06:30 PM IST -> Short Leave
  if (punchOutMinutes < shiftEndMin) {
    return 'short_leave';
  }

  // If punch-out is on/after 6:30 PM IST and current status is already short_leave 
  // (due to late punch-in between 9:40 and 11:30), keep it as short_leave
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

    if (!request.staff.isActive) {
      return response.status(403).json({
        success: false,
        message: 'Your account is deactivated. You cannot mark attendance.'
      });
    }

    const today = getTodayDateIST(); // YYYY-MM-DD format in IST

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

    // Determine status based on punch-in time (in IST)
    const currentTime = new Date();
    const status = getStatusFromPunchInTime(currentTime);
    const isLateShortLeave = status === 'short_leave';
    const notes = isLateShortLeave ? 'Late punch-in (after 09:40 AM) - Short Leave' : undefined;

    // Create new attendance record
    const attendance = new Attendance({
      staffId,
      date: today,
      punchInTime: currentTime,
      punchInLocation: {
        latitude,
        longitude
      },
      status: status,
      notes: notes
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
        formattedDate: attendance.formattedDate,
        punchInTime: attendance.punchInTime,
        formattedPunchInTime: attendance.formattedPunchInTime,
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
    const today = getTodayDateIST(); // YYYY-MM-DD format in IST

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
    const newStatus = getStatusFromPunchOutTime(attendance.status, punchOutTime, reasonType);
    
    // Add descriptive notes if early punch-out occurred
    const { hour: poH, minute: poM } = getISTTimeParts(punchOutTime);
    const poMin = poH * 60 + poM;
    if (poMin >= (16 * 60 + 30) && poMin < (18 * 60 + 30)) {
      if (newStatus === 'short_leave' && !attendance.notes?.includes('04:30 PM - 06:30 PM')) {
        attendance.notes = attendance.notes 
          ? `${attendance.notes} | Early punch-out (04:30 PM - 06:30 PM) - Short Leave` 
          : 'Early punch-out (04:30 PM - 06:30 PM) - Short Leave';
      }
    } else if (poMin < (16 * 60 + 30)) {
      if (newStatus === 'half_day' && !attendance.notes?.includes('before 04:30 PM')) {
        attendance.notes = attendance.notes 
          ? `${attendance.notes} | Early punch-out (before 04:30 PM) - Half Day` 
          : 'Early punch-out (before 04:30 PM) - Half Day';
      }
    }

    attendance.status = newStatus;

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
        formattedDate: attendance.formattedDate,
        punchInTime: attendance.punchInTime,
        formattedPunchInTime: attendance.formattedPunchInTime,
        punchOutTime: attendance.punchOutTime,
        formattedPunchOutTime: attendance.formattedPunchOutTime,
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
      const m = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      const lastDayStr = String(lastDay).padStart(2, '0');
      query.date = {
        $gte: `${year}-${m}-01`,
        $lte: `${year}-${m}-${lastDayStr}`
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

    // Auto-reconcile forgotten punch-outs on past dates to short_leave
    const todayIST = getTodayDateIST();
    for (const attendance of attendances) {
      if (attendance.date < todayIST && attendance.punchInTime && !attendance.punchOutTime && attendance.status === 'present') {
        attendance.status = 'short_leave';
        attendance.notes = attendance.notes ? `${attendance.notes} | Forgot to punch out` : 'Forgot to punch out';
        await attendance.save();
      }
    }

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
    const today = getTodayDateIST();

    const attendance = await Attendance.findOne({
      staffId,
      date: today
    });

    let status = 'off_duty';
    let punchInTime = null;
    let formattedPunchInTime = null;
    let totalHours = 0;
    let canApplyHalfDay = false;
    let punchOutTime = null;
    let formattedPunchOutTime = null;
    let hasPunchOut = false;

    if (attendance) {
      hasPunchOut = !!attendance.punchOutTime;
      if (attendance.punchOutTime) {
        status = 'completed';
        totalHours = attendance.totalHours;
        punchOutTime = attendance.punchOutTime;
        formattedPunchOutTime = attendance.formattedPunchOutTime;
      } else {
        status = 'on_duty';
        // Check if user can apply for half day
        canApplyHalfDay = isAfterHalfDayThreshold();
        // Calculate live elapsed hours so far
        if (attendance.punchInTime) {
          const inTime = new Date(attendance.punchInTime);
          const now = new Date();
          const diffMs = now.getTime() - inTime.getTime();
          if (diffMs > 0) {
            totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
          }
        }
      }
      punchInTime = attendance.punchInTime;
      formattedPunchInTime = attendance.formattedPunchInTime;
    }

    response.status(200).json({
      success: true,
      data: {
        status,
        punchInTime,
        formattedPunchInTime,
        punchOutTime,
        formattedPunchOutTime,
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
    const normRole = (role || '').toLowerCase().replace(/[\s-]/g, '_');
    if (!['super_admin', 'superadmin', 'admin'].includes(normRole)) {
      return response.status(403).json({
        success: false,
        message: 'Access denied. Super Administrator privileges required.'
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
      const m = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      const lastDayStr = String(lastDay).padStart(2, '0');
      query.date = {
        $gte: `${year}-${m}-01`,
        $lte: `${year}-${m}-${lastDayStr}`
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

    // Auto-reconcile forgotten punch-outs on past dates to short_leave
    const todayIST = getTodayDateIST();
    for (const attendance of attendances) {
      if (attendance.date < todayIST && attendance.punchInTime && !attendance.punchOutTime && attendance.status === 'present') {
        attendance.status = 'short_leave';
        attendance.notes = attendance.notes ? `${attendance.notes} | Forgot to punch out` : 'Forgot to punch out';
        await attendance.save();
      }
    }

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

// Helper for parsing manual date/time inputs
const parseManualDateTime = (dateStr, timeInput) => {
  if (!timeInput) return null;
  if (timeInput instanceof Date && !isNaN(timeInput.getTime())) return timeInput;

  if (typeof timeInput === 'string') {
    // Check for full ISO string
    if (timeInput.includes('T') || (timeInput.includes('-') && timeInput.includes(':'))) {
      const d = new Date(timeInput);
      if (!isNaN(d.getTime())) return d;
    }

    // Match "HH:mm", "HH:mm:ss", "HH:mm AM/PM"
    const match = timeInput.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = match[3] ? parseInt(match[3], 10) : 0;
      const meridiem = match[4] ? match[4].toLowerCase() : null;

      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;

      const pad = (n) => String(n).padStart(2, '0');
      const isoStr = `${dateStr}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}+05:30`;
      const d = new Date(isoStr);
      if (!isNaN(d.getTime())) return d;
    }

    const fallback = new Date(timeInput);
    if (!isNaN(fallback.getTime())) return fallback;
  }

  return null;
};

// Mark Manual Attendance (Super Admin / Admin / HR)
const markManualAttendance = async (request, response) => {
  try {
    const userRole = request.staff.role || request.staff.systemRole;
    if (!['super_admin', 'admin', 'hr'].includes(request.staff.role) && !['super_admin', 'admin', 'hr'].includes(request.staff.systemRole)) {
      return response.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    const { staffId, date, status = 'present', punchInTime, punchOutTime, notes } = request.body;

    if (!staffId) {
      return response.status(400).json({
        success: false,
        message: 'Staff ID is required'
      });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return response.status(400).json({
        success: false,
        message: 'A valid date in YYYY-MM-DD format is required'
      });
    }

    const targetStaff = await Staff.findById(staffId);
    if (!targetStaff) {
      return response.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (!targetStaff.isActive) {
      return response.status(400).json({
        success: false,
        message: `Cannot mark attendance for ${targetStaff.fullName}. This employee is deactivated/removed from the ERP.`
      });
    }

    const defaultLocation = { latitude: 30.6970439, longitude: 76.68684 };
    let parsedPunchIn = null;
    let parsedPunchOut = null;
    let totalHours = 0;

    const nonPunchStatuses = [
      'absent', 'medical_leave', 'casual_leave', 'maternity_leave',
      'lwp', 'holiday', 'compensatory_leave', 'bereavement_leave',
      'unmarked'
    ];

    if (status === 'unmarked') {
      await Attendance.findOneAndDelete({ staffId, date });
      return response.status(200).json({
        success: true,
        message: `Attendance cleared for ${targetStaff.fullName}`,
        data: null
      });
    }

    if (!nonPunchStatuses.includes(status)) {
      parsedPunchIn = parseManualDateTime(date, punchInTime);
      if (!parsedPunchIn) {
        // Fallback to 09:30 AM IST of that date
        parsedPunchIn = new Date(`${date}T09:30:00+05:30`);
      }

      if (punchOutTime) {
        parsedPunchOut = parseManualDateTime(date, punchOutTime);
        if (parsedPunchOut && parsedPunchIn) {
          const diffMs = parsedPunchOut.getTime() - parsedPunchIn.getTime();
          if (diffMs > 0) {
            totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
          }
        }
      }
    }

    let finalStatus = status;
    const adminName = request.staff.fullName || 'Admin';
    let finalNotes = notes ? notes.trim() : `Attendance marked manually by ${adminName}`;

    if (!nonPunchStatuses.includes(finalStatus) && parsedPunchIn && finalStatus === 'present') {
      const { hour: piH, minute: piM } = getISTTimeParts(parsedPunchIn);
      const punchMin = piH * 60 + piM;
      if (punchMin > (11 * 60 + 30)) {
        finalStatus = 'half_day';
        finalNotes = finalNotes ? `${finalNotes} | Late punch-in (after 11:30 AM) - Half Day` : 'Late punch-in (after 11:30 AM) - Half Day';
      } else if (punchMin > (9 * 60 + 40)) {
        finalStatus = 'short_leave';
        finalNotes = finalNotes ? `${finalNotes} | Late punch-in (09:40 AM - 11:30 AM) - Short Leave` : 'Late punch-in (09:40 AM - 11:30 AM) - Short Leave';
      }
    }

    if (!nonPunchStatuses.includes(finalStatus) && parsedPunchOut) {
      const { hour: poH, minute: poM } = getISTTimeParts(parsedPunchOut);
      const punchOutMin = poH * 60 + poM;
      if (punchOutMin < (16 * 60 + 30)) {
        finalStatus = 'half_day';
        finalNotes = finalNotes ? `${finalNotes} | Early punch-out (before 04:30 PM) - Half Day` : 'Early punch-out (before 04:30 PM) - Half Day';
      } else if (punchOutMin < (18 * 60 + 30)) {
        if (finalStatus !== 'half_day') {
          finalStatus = 'short_leave';
          finalNotes = finalNotes ? `${finalNotes} | Early punch-out (04:30 PM - 06:30 PM) - Short Leave` : 'Early punch-out (04:30 PM - 06:30 PM) - Short Leave';
        }
      }
    }

    const updateData = {
      staffId,
      date,
      status: finalStatus,
      punchInTime: parsedPunchIn,
      punchInLocation: defaultLocation,
      punchOutTime: parsedPunchOut,
      punchOutLocation: parsedPunchOut ? defaultLocation : null,
      totalHours,
      notes: finalNotes,
      isActive: true
    };

    const attendance = await Attendance.findOneAndUpdate(
      { staffId, date },
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('staffId', 'fullName email department designation role');

    return response.status(200).json({
      success: true,
      message: `Attendance marked successfully for ${targetStaff.fullName}`,
      data: attendance
    });

  } catch (error) {
    console.error('Mark manual attendance error:', error);
    return response.status(500).json({
      success: false,
      message: error.message || 'Internal server error while marking attendance'
    });
  }
};

// Mark Bulk Attendance (Super Admin / Admin / HR / TL)
const markBulkAttendance = async (request, response) => {
  try {
    const userRole = request.staff.role || request.staff.systemRole;
    if (!['super_admin', 'admin', 'hr', 'tl'].includes(request.staff.role) && !['super_admin', 'admin', 'hr', 'tl'].includes(request.staff.systemRole)) {
      return response.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    const { date, records } = request.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return response.status(400).json({
        success: false,
        message: 'A valid date in YYYY-MM-DD format is required'
      });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return response.status(400).json({
        success: false,
        message: 'Records array is required'
      });
    }

    // Fetch active staff ids to skip any deactivated/removed employees
    const requestedStaffIds = records.map((r) => r.staffId).filter(Boolean);
    const activeStaffDocs = await Staff.find({ _id: { $in: requestedStaffIds }, isActive: true }).select('_id');
    const activeStaffIdSet = new Set(activeStaffDocs.map((d) => d._id.toString()));

    const defaultLocation = { latitude: 30.6970439, longitude: 76.68684 };
    const nonPunchStatuses = [
      'absent', 'medical_leave', 'casual_leave', 'maternity_leave',
      'lwp', 'holiday', 'compensatory_leave', 'bereavement_leave',
      'unmarked'
    ];
    const adminName = request.staff.fullName || 'Super Admin';

    const results = [];
    for (const rec of records) {
      if (!rec.staffId) continue;
      // Skip inactive or removed employees
      if (!activeStaffIdSet.has(rec.staffId.toString())) {
        continue;
      }

      if (rec.status === 'unmarked') {
        await Attendance.findOneAndDelete({ staffId: rec.staffId, date });
        results.push({ staffId: rec.staffId, status: 'unmarked', cleared: true });
        continue;
      }

      let parsedPunchIn = null;
      let parsedPunchOut = null;
      let totalHours = 0;

      if (!nonPunchStatuses.includes(rec.status)) {
        parsedPunchIn = parseManualDateTime(date, rec.punchInTime);
        if (!parsedPunchIn && rec.status === 'present') {
          parsedPunchIn = new Date(`${date}T09:30:00+05:30`);
        }

        if (rec.punchOutTime) {
          parsedPunchOut = parseManualDateTime(date, rec.punchOutTime);
          if (parsedPunchOut && parsedPunchIn) {
            const diffMs = parsedPunchOut.getTime() - parsedPunchIn.getTime();
            if (diffMs > 0) {
              totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
            }
          }
        }
      }

      let recStatus = rec.status || 'present';
      let recNotes = rec.notes ? rec.notes.trim() : `Marked by ${adminName}`;

      if (!nonPunchStatuses.includes(recStatus) && parsedPunchIn && recStatus === 'present') {
        const { hour: piH, minute: piM } = getISTTimeParts(parsedPunchIn);
        const punchMin = piH * 60 + piM;
        if (punchMin > (11 * 60 + 30)) {
          recStatus = 'half_day';
          recNotes = recNotes ? `${recNotes} | Late punch-in (after 11:30 AM) - Half Day` : 'Late punch-in (after 11:30 AM) - Half Day';
        } else if (punchMin > (9 * 60 + 40)) {
          recStatus = 'short_leave';
          recNotes = recNotes ? `${recNotes} | Late punch-in (09:40 AM - 11:30 AM) - Short Leave` : 'Late punch-in (09:40 AM - 11:30 AM) - Short Leave';
        }
      }

      if (!nonPunchStatuses.includes(recStatus) && parsedPunchOut) {
        const { hour: poH, minute: poM } = getISTTimeParts(parsedPunchOut);
        const punchOutMin = poH * 60 + poM;
        if (punchOutMin < (16 * 60 + 30)) {
          recStatus = 'half_day';
          recNotes = recNotes ? `${recNotes} | Early punch-out (before 04:30 PM) - Half Day` : 'Early punch-out (before 04:30 PM) - Half Day';
        } else if (punchOutMin < (18 * 60 + 30)) {
          if (recStatus !== 'half_day') {
            recStatus = 'short_leave';
            recNotes = recNotes ? `${recNotes} | Early punch-out (04:30 PM - 06:30 PM) - Short Leave` : 'Early punch-out (04:30 PM - 06:30 PM) - Short Leave';
          }
        }
      }

      const updateData = {
        staffId: rec.staffId,
        date,
        status: recStatus,
        punchInTime: parsedPunchIn,
        punchInLocation: defaultLocation,
        punchOutTime: parsedPunchOut,
        punchOutLocation: parsedPunchOut ? defaultLocation : null,
        totalHours,
        notes: recNotes,
        isActive: true
      };

      const updated = await Attendance.findOneAndUpdate(
        { staffId: rec.staffId, date },
        updateData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push(updated);
    }

    return response.status(200).json({
      success: true,
      message: `Attendance marked successfully for ${results.length} employee(s)`,
      count: results.length
    });
  } catch (error) {
    console.error('Mark bulk attendance error:', error);
    return response.status(500).json({
      success: false,
      message: error.message || 'Internal server error while marking bulk attendance'
    });
  }
};

module.exports = {
  punchIn,
  punchOut,
  getAttendanceByStaff,
  getCurrentStatus,
  getAllStaffAttendance,
  markManualAttendance,
  markBulkAttendance
};



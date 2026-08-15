const express = require('express');
const router = express.Router();
const {
  punchIn,
  punchOut,
  getAttendanceByStaff,
  getCurrentStatus,
  getAllStaffAttendance
} = require('../../controllers/Attendance/Attendance.controller');
const { authenticateStaff } = require('../../controllers/Auth/staffProfile');

// All attendance routes require staff authentication
router.use(authenticateStaff);

// Punch In
router.post('/punch-in', punchIn);

// Punch Out
router.post('/punch-out', punchOut);

// Get current attendance status
router.get('/status', getCurrentStatus);

// Get all staff attendance (admin/hr only)
router.get('/all', getAllStaffAttendance);

// Get attendance records for the authenticated staff
router.get('/', getAttendanceByStaff);

module.exports = router;

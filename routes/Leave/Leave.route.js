const express = require('express');
const router = express.Router();

// Import leave controllers
const {
  getMyLeaveBalance,
  applyLeave,
  getMyLeaves,
  getPendingLeaves,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  cancelLeave,
  getLeaveStats
} = require('../../controllers/Leave/Leave.controller');

// Import staff authentication middleware
const { authenticateStaff, authorize } = require('../../controllers/Auth/staffProfile');

// All routes require staff authentication
router.use(authenticateStaff);

// Staff routes (can only access their own data)
router.get('/my/balance', getMyLeaveBalance);
router.get('/my', getMyLeaves);
router.post('/apply', applyLeave);
router.delete('/cancel/:id', cancelLeave);

// Approver routes (Super Admin, Admin, HR)
router.get('/pending', authorize('super_admin', 'admin', 'hr'), getPendingLeaves);
router.get('/stats', authorize('super_admin', 'admin', 'hr'), getLeaveStats);

// Admin routes (Super Admin, Admin only)
router.get('/all', authorize('super_admin', 'admin'), getAllLeaves);
router.patch('/approve/:id', authorize('super_admin', 'admin', 'hr'), approveLeave);
router.patch('/reject/:id', authorize('super_admin', 'admin', 'hr'), rejectLeave);

module.exports = router;


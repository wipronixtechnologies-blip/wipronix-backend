const express = require('express');
const router = express.Router();
const {
  getRecentActivities,
  getAllStaffLogs,
  getStaffActivitySummary
} = require('../../../controllers/Activity/activityController');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

// All activity routes require authentication
router.use(authenticateStaff);

// Only Super Admin has access to Staff Activity & Audit Trail
const restrictToSuperAdmin = (req, res, next) => {
  const isSuperAdmin = ['super_admin', 'admin'].includes(req.staff?.role) || req.staff?.systemRole === 'super_admin';
  if (isSuperAdmin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Staff Activity & Audit Trail is exclusively accessible to Super Admin.'
    });
  }
};

// Recent activities (dashboard widget) - ONLY for Super Admin
router.get('/', restrictToSuperAdmin, getRecentActivities);

// Super Admin: All Staff Audit Logs with Search, Category, Date, Staff Filters
router.get('/staff-logs', restrictToSuperAdmin, getAllStaffLogs);

// Super Admin: Aggregated activity summary across all staff members
router.get('/staff-summary', restrictToSuperAdmin, getStaffActivitySummary);

module.exports = router;

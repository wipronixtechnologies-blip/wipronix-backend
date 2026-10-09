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

// Recent activities (dashboard widget)
router.get('/', getRecentActivities);

// Super Admin & Privileged: All Staff Audit Logs with Search, Category, Date, Staff Filters
router.get('/staff-logs', getAllStaffLogs);

// Super Admin: Aggregated activity summary across all staff members
router.get('/staff-summary', getStaffActivitySummary);

module.exports = router;

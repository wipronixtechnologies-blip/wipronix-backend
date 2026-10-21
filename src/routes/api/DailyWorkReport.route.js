const express = require('express');
const router = express.Router();
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');
const dailyWorkReportController = require('../../../controllers/Report/dailyWorkReportController');

// All daily work report routes require authenticated staff
router.use(authenticateStaff);

// Submit / update today's daily work report
router.post('/', dailyWorkReportController.submitDailyWorkReport);

// Get my reports
router.get('/my', dailyWorkReportController.getMyDailyWorkReports);

// Get today's report
router.get('/today', dailyWorkReportController.getTodayDailyWorkReport);

// Super Admin / Admin: Get all daily work reports
router.get('/all', dailyWorkReportController.getAllDailyWorkReports);

// Super Admin / Admin: Review report (approve / reject)
router.patch('/:id/review', dailyWorkReportController.reviewDailyWorkReport);

module.exports = router;

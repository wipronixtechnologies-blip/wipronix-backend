const express = require('express');
const router = express.Router();
const { getRecentActivities } = require('../../../controllers/Activity/activityController');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

// All activity routes require authentication
router.use(authenticateStaff);

router.get('/', getRecentActivities);

module.exports = router;

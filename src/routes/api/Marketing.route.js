const express = require('express');
const router = express.Router();
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');
const { 
  getMarketingOverview, 
  addLead, 
  updateLeadStatus, 
  logDailyActivity, 
  createCampaign, 
  getLeads, 
  getCampaigns,
  getAllCollegesAnalytics,
  getCollegeStudentsHistory
} = require('../../../controllers/Marketing/marketingController');

router.use(authenticateStaff);

router.get('/overview', getMarketingOverview);
router.post('/leads', addLead);
router.put('/leads/:id', updateLeadStatus);
router.post('/activity', logDailyActivity);
router.get('/leads', getLeads);
router.get('/campaigns', getCampaigns);
router.post('/campaigns', createCampaign);

// Admin & Superadmin College Marketing Modules
router.get('/colleges-analytics', getAllCollegesAnalytics);
router.get('/colleges-analytics/students', getCollegeStudentsHistory);

module.exports = router;

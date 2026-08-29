const express = require('express');
const router = express.Router();
const jobController = require('../../../controllers/Job/jobController');
const { authenticateStaff, authorize } = require('../../../controllers/Auth/staffProfile');

// ==========================================
// PUBLIC ROUTES (For Candidates)
// ==========================================
router.get('/', jobController.getActiveJobs);
router.get('/:id', jobController.getJobDetails);
router.post('/apply', jobController.applyForJob);

// ==========================================
// PROTECTED ROUTES (For Admins / HR)
// ==========================================
router.use(authenticateStaff);
router.use(authorize('super_admin', 'admin', 'hr'));

router.get('/admin/all', jobController.getAdminJobs);
router.post('/admin/create', jobController.createJob);
router.put('/admin/:id', jobController.updateJob);
router.delete('/admin/:id', jobController.deleteJob);

router.get('/admin/applications', jobController.getApplications);
router.patch('/admin/applications/:id/status', jobController.updateApplicationStatus);

module.exports = router;

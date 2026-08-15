const express = require('express');
const router = express.Router();
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');
const placementController = require('../../../controllers/Placement/placementController');

// All placement routes require authentication
router.use(authenticateStaff);

// Test route (with auth)
router.get('/test', (req, res) => res.json({ success: true, message: 'VERIFIED: PLACEMENT ROUTES V2' }));

// Proposal Management
router.get('/proposals', placementController.getProposals);
router.post('/proposal', placementController.createProposal);

// Actions with IDs
router.post('/proposal/:id/send-email', placementController.sendProposalEmail);
router.get('/proposal/:id/preview', placementController.previewProposalPDF);
router.post('/proposal/:id/follow-up', placementController.addFollowUp);

// College / TPO Database
router.post('/college', placementController.addCollege);
router.get('/colleges', placementController.getColleges);

// Drive Scheduling
router.post('/drive', placementController.scheduleDrive);
router.get('/drives', placementController.getDrives);

// Student Submission
router.post('/candidate', placementController.addCandidate);
router.post('/candidates/bulk', placementController.bulkUploadCandidates);
router.get('/candidates/:driveId', placementController.getCandidates);
router.put('/candidate/:id/status', placementController.updateCandidateStatus);

// --- Training Head / BDE Routes ---
router.post('/college/assign', placementController.assignCollege);
router.get('/my-colleges', placementController.getMyColleges);
router.get('/bdes', placementController.getBDEs);

router.post('/goal', placementController.createGoal);
router.get('/goals', placementController.getGoals);
router.put('/goal/:id', placementController.updateGoal);

router.post('/report', placementController.submitDailyReport);
router.get('/reports', placementController.getDailyReports);

module.exports = router;

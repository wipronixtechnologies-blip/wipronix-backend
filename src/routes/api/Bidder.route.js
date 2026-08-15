const express = require('express');
const router = express.Router();
const bidderController = require('../../../controllers/Bidder/bidderController');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

// Middleware to authenticate staff
router.use(authenticateStaff);

router.get('/dashboard', bidderController.getBidderDashboard);
router.get('/proposals', bidderController.getProposals);
router.post('/proposals', bidderController.createProposal);
router.put('/proposals/:id', bidderController.updateProposalStatus);
router.put('/proposals/:id/handover', bidderController.updateHandover);
router.get('/proposals/:id/logs', bidderController.getCommunicationLogs);
router.post('/proposals/:id/logs', bidderController.addCommunicationLog);

module.exports = router;

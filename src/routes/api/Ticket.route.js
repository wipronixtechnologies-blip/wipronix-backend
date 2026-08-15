const express = require('express');
const router = express.Router();
const ticketController = require('../../../controllers/Ticket/ticketController');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

router.use(authenticateStaff);

router.post('/', ticketController.createRequest);
router.get('/', ticketController.getMyRequests);

// Admin routes
router.get('/all', ticketController.getAllRequests);
router.put('/:ticketId/status', ticketController.updateRequestStatus);

module.exports = router;

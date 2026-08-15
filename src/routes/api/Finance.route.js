const express = require('express');
const router = express.Router();
const financeController = require('../../../controllers/Finance/financeController');
const { authenticateStaff, checkPermission } = require('../../../controllers/Auth/staffProfile');

router.use(authenticateStaff);

router.get('/payments', financeController.getAllPayments);
router.get('/stats', financeController.getFinanceStats);
router.post('/payments', checkPermission('Finance:write'), financeController.addPayment);

module.exports = router;

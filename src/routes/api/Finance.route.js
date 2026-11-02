const express = require('express');
const router = express.Router();
const financeController = require('../../../controllers/Finance/financeController');
const { authenticateStaff, checkPermission } = require('../../../controllers/Auth/staffProfile');

router.use(authenticateStaff);

// General payments & revenue
router.get('/payments', financeController.getAllPayments);
router.get('/stats', financeController.getFinanceStats);
router.get('/enrolled-students', financeController.getEnrolledStudents);
router.post('/payments', checkPermission('Finance:write'), financeController.addPayment);

// Registration slips verification & approvals (Superadmin / Finance Module)
router.get('/registration-slips', financeController.getAllRegistrationSlips);
router.post('/verify-registration-slip/:slipId', financeController.verifyRegistrationSlip);

module.exports = router;

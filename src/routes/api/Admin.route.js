const express = require('express');
const router = express.Router();
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');
const adminController = require('../../../controllers/Admin/adminController');

router.use(authenticateStaff);

// Only Super Admin / Admin access
const restrictToAdmin = (req, res, next) => {
    if (req.staff.role === 'super_admin' || req.staff.role === 'admin' || req.staff.systemRole === 'super_admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Forbidden' });
    }
};

router.get('/overview', restrictToAdmin, adminController.getOrganizationOverview);
router.get('/approvals', restrictToAdmin, adminController.getPendingApprovals);

module.exports = router;

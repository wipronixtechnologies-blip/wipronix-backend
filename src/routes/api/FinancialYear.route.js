const express = require('express');
const router = express.Router();
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');
const financialYearController = require('../../../controllers/Attendance/financialYearController');

// All routes require authentication
router.use(authenticateStaff);

// GET /api/financial-years - List all financial years dynamically
router.get('/', financialYearController.getFinancialYears);

// POST /api/financial-years - Create new financial year (Super Admin / Admin)
router.post('/', financialYearController.createFinancialYear);

// PUT /api/financial-years/:id - Update financial year (Super Admin / Admin)
router.put('/:id', financialYearController.updateFinancialYear);

// DELETE /api/financial-years/:id - Delete financial year (Super Admin / Admin)
router.delete('/:id', financialYearController.deleteFinancialYear);

// PUT /api/financial-years/:id/set-current - Set current active financial year
router.put('/:id/set-current', financialYearController.setCurrentFinancialYear);

module.exports = router;

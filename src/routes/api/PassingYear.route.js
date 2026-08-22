const express = require('express');
const router = express.Router();

const getAllPassingYear = require('../../../controllers/PassingYear/getAllPassingYear');
const createPassingYear = require('../../../controllers/PassingYear/createPassingYear');
const updatePassingYear = require('../../../controllers/PassingYear/updatePassingYear');
const deletePassingYear = require('../../../controllers/PassingYear/deletePassingYear');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

// Public route to fetch all options
router.get('/', getAllPassingYear);

// All write routes require staff authentication
router.use(authenticateStaff);

router.post('/', createPassingYear);
router.put('/:id', updatePassingYear);
router.delete('/:id', deletePassingYear);

module.exports = router;

const express = require('express');
const router = express.Router();

const getAllHighestEducation = require('../../../controllers/HighestEducation/getAllHighestEducation');
const createHighestEducation = require('../../../controllers/HighestEducation/createHighestEducation');
const updateHighestEducation = require('../../../controllers/HighestEducation/updateHighestEducation');
const deleteHighestEducation = require('../../../controllers/HighestEducation/deleteHighestEducation');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

// Public route to fetch all education options
router.get('/', getAllHighestEducation);

// All write routes require staff authentication
router.use(authenticateStaff);

router.post('/', createHighestEducation);
router.put('/:id', updateHighestEducation);
router.delete('/:id', deleteHighestEducation);

module.exports = router;

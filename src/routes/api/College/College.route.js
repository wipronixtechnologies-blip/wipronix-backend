const express = require('express');
const router = express.Router();

const createCollege = require('../../../../controllers/College/createCollege');
const getAllColleges = require('../../../../controllers/College/getAllColleges');
const getCollegeById = require('../../../../controllers/College/getCollegeById');
const updateCollege = require('../../../../controllers/College/updateCollege');
const deleteCollege = require('../../../../controllers/College/deleteCollege');
const { authenticateStaff } = require('../../../../controllers/Auth/staffProfile');

// Public endpoints - Get all colleges and get college by ID (no auth required for internship portal)
router.get('/', getAllColleges);
router.get('/:id', getCollegeById);

// All other routes require staff authentication
router.use(authenticateStaff);

// College CRUD operations
router.post('/', createCollege);
router.put('/:id', updateCollege);
router.delete('/:id', deleteCollege);

module.exports = router;


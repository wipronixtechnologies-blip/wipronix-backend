const express = require('express');
const router = express.Router();

const getAllCourseOption = require('../../../controllers/CourseOption/getAllCourseOption');
const createCourseOption = require('../../../controllers/CourseOption/createCourseOption');
const updateCourseOption = require('../../../controllers/CourseOption/updateCourseOption');
const deleteCourseOption = require('../../../controllers/CourseOption/deleteCourseOption');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

// Public route to fetch all course options
router.get('/', getAllCourseOption);

// All write routes require staff authentication
router.use(authenticateStaff);

router.post('/', createCourseOption);
router.put('/:id', updateCourseOption);
router.delete('/:id', deleteCourseOption);

module.exports = router;

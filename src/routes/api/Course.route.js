const express = require('express');
const router = express.Router();
const courseController = require('../../../controllers/Courses/courseController');
const { authenticateStaff, checkPermission } = require('../../../controllers/Auth/staffProfile');

// All course routes require authentication
router.use(authenticateStaff);

router.get('/', courseController.getAllCourses);
router.get('/:id', courseController.getCourseById);

// Modifications require permissions
router.post('/', checkPermission('Courses:write'), courseController.createCourse);
router.put('/:id', checkPermission('Courses:write'), courseController.updateCourse);
router.delete('/:id', checkPermission('Courses:delete'), courseController.deleteCourse);

module.exports = router;

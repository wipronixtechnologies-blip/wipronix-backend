const express = require('express');
const router = express.Router();
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');
const counselorController = require('../../../controllers/Counselor/counselorController');

// Protect all counselor routes with staff authentication
router.use(authenticateStaff);

// Overview Stats
router.get('/overview', counselorController.getCounselorOverview);

// BDE List with stats
router.get('/bdes', counselorController.getBDEs);

// College Student Pool Stats
router.get('/colleges-stats', counselorController.getCollegesStudentStats);

// Assigned/Unassigned Students with Filters
router.get('/students', counselorController.getAssignedStudents);

// My Assigned Students (for logged-in counselor)
router.get('/my-students', counselorController.getMyAssignedStudents);


// Assign Students (sequential remaining distribution)
router.post('/assign-students', counselorController.assignStudents);

// Unassign Students
router.post('/unassign-students', counselorController.unassignStudents);

// Reassign Students
router.post('/reassign-students', counselorController.reassignStudents);

// Update Status & Notes
router.patch('/student-status/:id', counselorController.updateCounselingStatus);

module.exports = router;

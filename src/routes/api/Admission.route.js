const express = require('express');
const router = express.Router();
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');
const admissionController = require('../../../controllers/Admission/admissionController');

router.use(authenticateStaff);

router.get('/overview', admissionController.getAdmissionOverview);
router.get('/students', admissionController.getStudents);
router.post('/student', admissionController.addStudent);

router.get('/fees', admissionController.getFeePayments);
router.post('/fee', admissionController.addFeePayment);

router.post('/interaction', admissionController.addStudentInteraction);
router.get('/interaction/:studentId', admissionController.getStudentInteractions);

module.exports = router;

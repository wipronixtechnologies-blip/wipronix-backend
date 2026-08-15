const express = require('express');
const router = express.Router();
const developmentController = require('../../../controllers/Performance/developmentController');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

router.use(authenticateStaff);

// Employee routes
router.get('/my-trainings', developmentController.getMyTrainings);
router.patch('/progress/:trainingId', developmentController.updateProgress);

// Admin routes
router.post('/assign', developmentController.assignTraining);
router.get('/all', developmentController.getAllStaffTrainings);

module.exports = router;

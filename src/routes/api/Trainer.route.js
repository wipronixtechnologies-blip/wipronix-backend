const express = require('express');
const router = express.Router();
const trainerController = require('../../../controllers/Trainers/trainerController');
const { authenticateStaff, checkPermission } = require('../../../controllers/Auth/staffProfile');

// All trainer routes require authentication
router.use(authenticateStaff);

router.get('/', trainerController.getAllTrainers);
router.get('/:id', trainerController.getTrainerById);

// Modifications require permissions
router.post('/', checkPermission('Trainers:write'), trainerController.createTrainer);
router.put('/:id', checkPermission('Trainers:write'), trainerController.updateTrainer);
router.delete('/:id', checkPermission('Trainers:delete'), trainerController.deleteTrainer);

module.exports = router;

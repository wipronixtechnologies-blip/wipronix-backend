const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middlewares/auth');
const {
    createResignation,
    getMyResignation,
    getAllResignations,
    updateResignationStatus
} = require('../../controllers/Resignation/resignationController');

router.post('/', protect, createResignation);
router.get('/my', protect, getMyResignation);
router.get('/', protect, authorize('admin', 'super_admin', 'hr'), getAllResignations);
router.put('/:id', protect, authorize('admin', 'super_admin', 'hr'), updateResignationStatus);

module.exports = router;

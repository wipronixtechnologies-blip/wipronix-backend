const express = require('express');
const router = express.Router();
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');
const {
    createResignation,
    getMyResignation,
    getAllResignations,
    updateResignationStatus,
    uploadResignationLetter,
    uploadMiddleware
} = require('../../../controllers/Resignation/resignationController');

// All resignation routes require staff authentication
router.use(authenticateStaff);

router.post('/', createResignation);
router.get('/my', getMyResignation);
router.post('/upload-letter', uploadMiddleware, uploadResignationLetter);

// Admin/HR routes - need additional role check middleware?
//authenticateStaff adds req.user. Let's assume controller handles authorization or add middleware if available.
// I'll add a simple role check middleware inline or use existing if any.
// Looking at Staff.model: role enum: super_admin, admin, hr.
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.staff.role) && !roles.includes(req.staff.systemRole)) {
            return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
        }
        next();
    };
};

router.get('/', restrictTo('admin', 'super_admin', 'hr'), getAllResignations);
router.put('/:id', restrictTo('admin', 'super_admin', 'hr'), updateResignationStatus);

module.exports = router;

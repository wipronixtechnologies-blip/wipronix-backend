const express = require('express');
const router = express.Router();

// Import separate staff controllers
const { getAllStaff } = require('../../../controllers/Staff/getAllStaff');
const { getStaffById } = require('../../../controllers/Staff/getStaffById');
const { createStaff } = require('../../../controllers/Staff/createStaff');
const { updateStaff } = require('../../../controllers/Staff/updateStaff');
const { deleteStaff } = require('../../../controllers/Staff/deleteStaff');
const { getStaffForDropdown } = require('../../../controllers/Staff/getStaffForDropdown');
const { getStaffStats } = require('../../../controllers/Staff/getStaffStats');
const { registerStaff } = require('../../../controllers/Staff/registerStaff');
const { sendOfferLetter } = require('../../../controllers/Staff/sendOfferLetter');
const { terminateStaff } = require('../../../controllers/Staff/terminateStaff');
const { getDepartments } = require('../../../controllers/Staff/getDepartments');
const { generateOfferLetter } = require('../../../controllers/Staff/generateOfferLetter');
const { sendWelcomeEmail } = require('../../../controllers/Staff/sendWelcomeEmail');
const { verifyDocument } = require('../../../controllers/Staff/verifyDocument');

// Import staff-specific auth middleware
const { authenticateStaff, authorize, checkPermission } = require('../../../controllers/Auth/staffProfile');
// Import protectSuperAdmin middleware
const protectSuperAdmin = require('../../middlewares/protectSuperAdmin');
// Import task routes
const taskRoutes = require('../../../routes/Task/taskRoutes');

// Public route - no authentication required for registration
router.post('/register', registerStaff);

// All routes require staff authentication
router.use(authenticateStaff);

// Offer letter generation
router.get('/:id/generate-offer-letter', generateOfferLetter);
router.post('/:id/send-welcome-email', authorize('super_admin', 'admin', 'hr'), sendWelcomeEmail);


// Staff CRUD operations
router.get('/', getAllStaff);
router.get('/dropdown', getStaffForDropdown);
router.get('/stats', getStaffStats);
router.get('/departments', getDepartments);
router.get('/:id', getStaffById);

// Protect super admin operations - require super_admin role for modifications
router.post('/', protectSuperAdmin, createStaff);
router.put('/:id', protectSuperAdmin, updateStaff);
router.delete('/:id', protectSuperAdmin, deleteStaff);

// Send offer letter - only super_admin can send
router.post('/:id/send-offer-letter', sendOfferLetter);

// Verify document - only super_admin, hr can verify
router.put('/:id/verify-document', authorize('super_admin', 'hr'), verifyDocument);

// Terminate staff - only super_admin or hr can terminate
router.post('/:id/terminate', terminateStaff);

// Task routes - nested under /api/staff/tasks
router.use('/tasks', taskRoutes);

module.exports = router;


const express = require('express');
const router = express.Router();

const webinarController = require('../../../controllers/Webinar/webinarController');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

// Strict Super Admin guard middleware
const restrictToSuperAdmin = (req, res, next) => {
  if (!req.staff) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const isSuper = req.staff.role === 'super_admin' || req.staff.systemRole === 'super_admin';
  if (!isSuper) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Webinar management is strictly restricted to Super Admin.'
    });
  }

  next();
};

// ============================================================================
// PUBLIC ROUTES (No staff login needed - used by website visitors)
// ============================================================================
router.get('/active', webinarController.getActiveWebinar);
router.get('/details/:id', webinarController.getWebinarById);
router.post('/register', webinarController.registerForWebinar);

// ============================================================================
// SUPER ADMIN ONLY ROUTES (Strictly super_admin only)
// ============================================================================
router.use(authenticateStaff);
router.use(restrictToSuperAdmin);

// Webinar CRUD
router.get('/', webinarController.getAllWebinars);
router.post('/', webinarController.createWebinar);
router.put('/:id', webinarController.updateWebinar);
router.patch('/:id/toggle-status', webinarController.toggleWebinarStatus);
router.delete('/:id', webinarController.deleteWebinar);

// Registration list & management
router.get('/registrations/:webinarId', webinarController.getWebinarRegistrations);
router.delete('/registrations/:registrationId', webinarController.deleteWebinarRegistration);

module.exports = router;

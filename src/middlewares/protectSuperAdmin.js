const Staff = require('../../models/Staff.model');

// Middleware to protect super_admin from being modified by non-super-admins
const protectSuperAdmin = async (req, res, next) => {
  try {
    console.log('[protectSuperAdmin] Middleware triggered');

    // Defensive check - if staff is not authenticated, let other middleware handle it
    if (!req.staff) {
      return next();
    }

    // Defensive check - if staff doesn't have a role, let other middleware handle it
    if (!req.staff.role) {
      console.warn('ProtectSuperAdmin Middleware - Staff authenticated but no role found:', req.staff._id);
      return next();
    }

    const targetStaffId = req.params.id;
    console.log('ProtectSuperAdmin Middleware - Target Staff ID:', targetStaffId);
    console.log('ProtectSuperAdmin Middleware - Attempting to create super_admin',req.body.role);
    
    // If no ID in params, this is a create operation, check the body
    if (!targetStaffId && req.body) {
      console.log('[protectSuperAdmin] Create operation detected');
      // For create operations, check if trying to create a super_admin

      if (req.body.role === 'super_admin' || req.body.systemRole === 'super_admin') {
        // Only super_admin can create another super_admin
        if (req.staff.role !== 'super_admin' && req.staff.systemRole !== 'super_admin') {
          console.warn('[protectSuperAdmin] Forbidden: Non-super_admin trying to create super_admin');
          return res.status(403).json({
            success: false,
            message: 'Only super admins can create super admin accounts'
          });
        }
      }
      return next();
    }

    if (!targetStaffId) {
      return next();
    }

    // Get the target staff member
    const targetStaff = await Staff.findById(targetStaffId);

    if (!targetStaff) {
      console.log('[protectSuperAdmin] Target staff not found, skipping check');
      return next(); // Staff not found, let the controller handle it
    }

    console.log(`[protectSuperAdmin] Target found: ${targetStaff.email} (${targetStaff.role})`);

    // Check if target is a super_admin
    if (targetStaff.role === 'super_admin' || targetStaff.systemRole === 'super_admin') {
      console.log('[protectSuperAdmin] Target is super_admin');
      // Only super_admin can modify another super_admin
      // Use role from request body if provided, otherwise use from authenticated staff
      const requestingStaffRole = req.body.role || req.staff.role;
      if (requestingStaffRole !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Super admin accounts can only be modified by super admins'
        });
      }
    }

    // Check if trying to change role TO super_admin (only super_admin can do this)
    const newRole = req.body ? req.body.role : undefined;
    const newSystemRole = req.body ? req.body.systemRole : undefined;
    
    // Use role from request body if provided, otherwise use from authenticated staff
    const requestingStaffRole = req.body.role || req.staff.role;
    if ((newRole === 'super_admin' || newSystemRole === 'super_admin') && requestingStaffRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can assign super admin role'
      });
    }

    console.log('[protectSuperAdmin] Check passed');
    next();
  } catch (error) {
    console.error('[protectSuperAdmin] CRITICAL ERROR:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid Staff ID format in protection middleware',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error in protectSuperAdmin',
      error: error.message
    });
  }
};

module.exports = protectSuperAdmin;


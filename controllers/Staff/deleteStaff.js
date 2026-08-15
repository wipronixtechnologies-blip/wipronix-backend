const Staff = require('../../models/Staff.model');
const { logActivity } = require('../Activity/activityController');

// Delete staff
exports.deleteStaff = async (req, res) => {
  try {
    // 1. Validate Request & Authentication
    if (!req.staff) {
        console.error('[deleteStaff] Error: req.staff is missing. Middleware might have failed.');
        return res.status(401).json({ success: false, message: 'Unauthorized: Staff context missing' });
    }

    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ success: false, message: 'Staff ID is required' });
    }

    const targetId = id.trim();
    
    // Safely get requester details
    const requesterId = req.staff.id || (req.staff._id ? req.staff._id.toString() : null);
    const requesterRole = req.staff.role || 'employee';
    const requesterSystemRole = req.staff.systemRole || 'employee';

    if (!requesterId) {
        console.error('[deleteStaff] Error: Unable to determine requester ID');
        return res.status(500).json({ success: false, message: 'Internal Error: Invalid requester context' });
    }

    console.log(`[deleteStaff] Attempting to delete ID: ${targetId} by Requester: ${requesterId} (${requesterRole})`);

    // 2. Validate Target ID Format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ success: false, message: 'Invalid Staff ID format' });
    }

    // 3. Fetch Target Staff
    const targetStaff = await Staff.findById(targetId);
    
    if (!targetStaff) {
      console.warn(`[deleteStaff] Staff member not found: ${targetId}`);
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    console.log(`[deleteStaff] Target Found: ${targetStaff.fullName} (${targetStaff.role})`);

    // 4. Permission Checks
    
    // Prevent self-deletion
    if (targetId === requesterId) {
      console.warn(`[deleteStaff] Self-deletion blocked for user: ${requesterId}`);
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Protect Super Admin Validation
    const isTargetSuperAdmin = targetStaff.role === 'super_admin' || targetStaff.systemRole === 'super_admin';
    const isRequesterSuperAdmin = requesterRole === 'super_admin' || requesterSystemRole === 'super_admin';

    if (isTargetSuperAdmin && !isRequesterSuperAdmin) {
      console.warn(`[deleteStaff] Forbidden: Requester ${requesterId} tried to delete super_admin ${targetId}`);
      return res.status(403).json({
        success: false,
        message: 'Super admin accounts can only be deleted by super admins'
      });
    }

    // 5. Cleanup Related Data (Subordinates)
    // Update staff members who report to this person to prevent broken references
    const updateResult = await Staff.updateMany(
      { reportingTo: targetId },
      { $set: { reportingTo: null } }
    );
    console.log(`[deleteStaff] Updated ${updateResult.modifiedCount} subordinates who reported to ${targetId}`);

    // 6. Perform Deletion
    const deletionResult = await Staff.findByIdAndDelete(targetId);

    if (!deletionResult) {
      // Should not happen as we checked existence, but handling race conditions
      return res.status(404).json({
        success: false,
        message: 'Staff not found during deletion (Race condition)'
      });
    }

    console.log(`[deleteStaff] Successfully deleted staff: ${targetId}`);

    res.status(200).json({
      success: true,
      message: 'Staff deleted successfully'
    });

    // Log Activity
    logActivity({
        type: 'staff_deleted',
        user: req.staff.fullName,
        actorId: requesterId,
        action: `deleted staff account: ${targetStaff.fullName}`,
        target: targetStaff.fullName,
        targetId: targetId
    });

    return;

  } catch (error) {
    console.error('[deleteStaff] CRITICAL ERROR:', error);
    console.error(error.stack);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to delete staff',
      error: error.message || 'Unknown Server Error'
    });
  }
};

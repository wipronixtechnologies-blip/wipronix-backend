const bcrypt = require('bcryptjs');
const Staff = require('../../models/Staff.model');
const { logActivity } = require('../Activity/activityController');

// Update staff
exports.updateStaff = async (req, res) => {
  try {
    // 1. Validate Request Context
    if (!req.staff) {
        console.error('[updateStaff] Error: req.staff is missing.');
        return res.status(401).json({ success: false, message: 'Unauthorized: Staff context missing' });
    }

    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ success: false, message: 'Staff ID is required' });
    }

    const targetId = id.trim();
    console.log(`[updateStaff] Updating staff ID: ${targetId}`);

    const {
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      dateOfBirth,
      address,
      profileImage,
      dateOfJoining,
      department,
      designation,
      reportingTo,
      systemRole,
      employeeType,
      salaryStructure,
      documents,
      role,
      isActive,
      permissions
    } = req.body;

    // 2. Validate Target ID Format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ success: false, message: 'Invalid Staff ID format' });
    }

    // 3. Get the target staff member
    const targetStaff = await Staff.findById(targetId);
    
    if (!targetStaff) {
      console.warn(`[updateStaff] Staff not found: ${targetId}`);
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // 4. Permission Checks
    
    // Check if target is a super_admin
    const isTargetSuperAdmin = targetStaff.role === 'super_admin' || targetStaff.systemRole === 'super_admin';
    const requesterRole = req.staff.role || 'employee';
    const requesterSystemRole = req.staff.systemRole || 'employee';
    const isRequesterSuperAdmin = requesterRole === 'super_admin' || requesterSystemRole === 'super_admin';

    // Only super_admin can modify another super_admin
    if (isTargetSuperAdmin && !isRequesterSuperAdmin) {
      console.warn(`[updateStaff] Forbidden: Requester ${req.staff._id} tried to modify super_admin ${targetId}`);
      return res.status(403).json({
        success: false,
        message: 'Super admin accounts can only be modified by super admins'
      });
    }

    // Check if trying to change role TO super_admin (only super_admin can do this)
    if ((role === 'super_admin' || systemRole === 'super_admin') && !isRequesterSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can assign super admin role'
      });
    }

    const updateData = {
      firstName,
      lastName,
      fullName: (firstName || lastName) ? `${firstName || targetStaff.firstName} ${lastName || targetStaff.lastName}`.trim() : undefined,
      phoneNumber,
      dateOfBirth,
      address,
      profileImage,
      dateOfJoining,
      department,
      designation,
      reportingTo,
      systemRole,
      employeeType,
      salaryStructure,
      documents,
      role,
      isActive,
      permissions
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key =>
      updateData[key] === undefined && delete updateData[key]
    );

    // Only update email if it's different and not already taken
    if (email && email !== targetStaff.email) {
      const existingStaff = await Staff.findOne({ email, _id: { $ne: targetId } });
      if (existingStaff) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
      updateData.email = email;
    }

    // Only update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const staff = await Staff.findByIdAndUpdate(
      targetId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found during update'
      });
    }

    console.log(`[updateStaff] Successfully updated staff: ${targetId}`);

    res.status(200).json({
      success: true,
      message: 'Staff updated successfully',
      data: staff
    });

    // Log Activity
    logActivity({
        type: 'staff_updated',
        user: req.staff.fullName,
        actorId: req.staff._id,
        action: `updated staff details for ${staff.fullName}`,
        target: staff.fullName,
        targetId: targetId,
        metadata: { updatedFields: Object.keys(updateData) }
    });

  } catch (error) {
    console.error('[updateStaff] Error updating staff:', error);
    
    if (error.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid Staff ID format',
            error: error.message
        });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update staff',
      error: error.message
    });
  }
};

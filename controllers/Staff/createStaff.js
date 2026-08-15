const Staff = require('../../models/Staff.model');
const { sendStaffWelcomeEmail } = require('../../src/services/emailService');
const { getDefaultPermissionsForRole } = require('../../utils/permissionUtils');

// Create new staff
exports.createStaff = async (req, res) => {
  try {
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
      // Offer details from new frontend fields
      offerReferenceNo,
      workMode,
      probationDuration,
      retentionBonusAmount,
      retentionBonusPeriod
    } = req.body;

    // Check if email already exists
    const existingStaff = await Staff.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Only super_admin can create another super_admin
    const isRequesterSuperAdmin = req.staff.role === 'super_admin' || req.staff.systemRole === 'super_admin';
    if ((role === 'super_admin' || systemRole === 'super_admin') && !isRequesterSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can create super admin accounts'
      });
    }

    // Use phoneNumber as password if not provided
    const userPassword = password || phoneNumber;

    // Generate sequential offerReferenceNo if not provided
    let finalOfferRefNo = offerReferenceNo;
    if (!finalOfferRefNo) {
      const staffCount = await Staff.countDocuments();
      const nextNum = staffCount + 1;
      const year = new Date().getFullYear();
      finalOfferRefNo = `WIP/HR/${year}/${String(nextNum).padStart(3, '0')}`;
    }

    const staff = new Staff({
      firstName,
      lastName,
      email,
      password: userPassword,
      phoneNumber,
      dateOfBirth,
      address: address || {},
      profileImage,
      dateOfJoining,
      department,
      designation,
      reportingTo: reportingTo || null,
      systemRole: systemRole || 'employee',
      employeeType: employeeType || 'full_time',
      salaryStructure: salaryStructure || {
        baseSalary: 0,
        hra: 0,
        transport: 0,
        other: 0,
        taxDeduction: 0,
        pf: 0
      },
      documents: documents || {},
      role: role || 'employee',
      isActive: isActive !== undefined ? isActive : true,
      permissions: role ? getDefaultPermissionsForRole(role) : getDefaultPermissionsForRole('employee'),
      // Offer details
      offerReferenceNo: finalOfferRefNo,
      workMode,
      probationDuration,
      retentionBonusAmount,
      retentionBonusPeriod
    });

    await staff.save();

    // Send welcome email asynchronously (don't wait for it to complete)
    // This ensures the staff creation succeeds even if email fails
    const staffData = {
      fullName: staff.fullName,
      email: staff.email,
      designation: staff.designation
    };
    
    // Send welcome email in the background
    sendStaffWelcomeEmail(staffData, password).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      data: staff.toJSON()
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create staff',
      error: error.message
    });
  }
};

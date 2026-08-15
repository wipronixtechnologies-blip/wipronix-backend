const Staff = require('../../models/Staff.model');
const bcrypt = require('bcryptjs');
const { getDefaultPermissionsForRole } = require('../../utils/permissionUtils');

// Register new staff member (handles legacy payload format)
exports.registerStaff = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      password,
      role,
      department,
      designation,
      phoneNumber,
      createdBy
    } = req.body;

    // Check if email already exists
    const existingStaff = await Staff.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Split fullName into firstName and lastName for the new model schema
    const nameParts = (fullName || '').trim().split(' ');
    const firstName = nameParts[0] || 'Staff';
    const lastName = nameParts.slice(1).join(' ') || 'Member';

    const staff = new Staff({
      firstName,
      lastName,
      fullName: fullName || `${firstName} ${lastName}`.trim(),
      email,
      password,
      phoneNumber,
      department,
      designation,
      systemRole: role || 'employee',
      role: role || 'employee',
      isActive: true,
      permissions: role ? getDefaultPermissionsForRole(role) : getDefaultPermissionsForRole('employee'),
      // Set default values for required fields
      employeeType: 'full_time',
      salaryStructure: {
        baseSalary: 0,
        hra: 0,
        transport: 0,
        other: 0,
        taxDeduction: 0,
        pf: 0
      },
      address: {},
      documents: {}
    });

    await staff.save();

    // Return staff data without password
    const staffResponse = staff.toJSON();

    res.status(201).json({
      success: true,
      message: 'Staff registered successfully',
      data: staffResponse
    });
  } catch (error) {
    console.error('Error registering staff:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to register staff',
      error: error.message
    });
  }
};

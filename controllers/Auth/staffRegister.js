const jwt = require('jsonwebtoken');
const Staff = require('../../models/Staff.model');

// Validation schemas for roles
const rolePermissions = {
  super_admin: [
    'manage_users',
    'manage_staff',
    'manage_courses',
    'manage_students',
    'view_analytics',
    'manage_settings',
    'manage_roles',
    'view_all_data'
  ],
  admin: [
    'manage_users',
    'manage_courses',
    'manage_students',
    'view_analytics',
    'view_all_data'
  ],
  hr: [
    'manage_staff',
    'manage_salary',
    'view_employees',
    'manage_documents'
  ],
  staff: [
    'manage_courses',
    'view_students',
    'view_analytics'
  ],
  employee: [
    'view_own_data',
    'view_courses'
  ]
};


const staffRegister = async (request, response, next) => {
  try {
    const { 
      fullName,
      lastName,
      email, 
      password, 
      role, 
      department, 
      designation,
      phoneNumber,
      createdBy
    } = request.body;

    // Validate required fields
    if (!fullName || !lastName || !email || !password) {
      return response.status(400).json({
        success: false,
        message: 'First name, last name, email, and password are required'
      });
    }

    // Validate role if provided
    const validRoles = ['super_admin', 'admin', 'hr', 'staff', 'employee'];
    const userRole = role && validRoles.includes(role) ? role : 'employee';

    // Check if email already exists
    const existingStaff = await Staff.findOne({ email });
    
    if (existingStaff) {
      return response.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create new staff member
    const staff = new Staff({
      fullName,
      lastName,
      email,
      password, // Password will be hashed by pre-save middleware
      role: userRole,
      systemRole: userRole,
      department,
      designation,
      phoneNumber,
      permissions: rolePermissions[userRole] || rolePermissions.employee
    });

    await staff.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: staff._id, 
        email: staff.email,
        role: staff.role,
        userType: 'staff'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Set cookie
    response.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    response.status(201).json({
      success: true,
      message: 'Staff registered successfully',
      token,
      user: {
        id: staff._id,
        fullName: staff.fullName,
        lastName: staff.lastName,
        fullName: staff.fullName,
        email: staff.email,
        role: staff.role,
        department: staff.department,
        designation: staff.designation,
        permissions: staff.permissions
      }
    });

  } catch (error) {
    console.error('Staff registration error:', error);
    
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    next(error);
  }
};

module.exports = staffRegister;


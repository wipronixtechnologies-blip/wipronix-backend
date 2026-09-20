const jwt = require('jsonwebtoken');
const Staff = require('../../models/Staff.model');

// Authenticate staff middleware
const authenticateStaff = async (request, response, next) => {
  try {
    // Get token from cookies, Authorization header, or query string
    const token = request.cookies.token ||
      (request.headers.authorization && request.headers.authorization.startsWith('Bearer ')
        ? request.headers.authorization.slice(7)
        : null) ||
      request.query.token;

    if (!token) {
      return response.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Check if it's a staff token
    if (decoded.userType !== 'staff') {
      return response.status(403).json({
        success: false,
        message: 'Access denied. Staff access required.'
      });
    }

    // Get staff from database
    const staff = await Staff.findById(decoded.userId).select('-password');

    if (!staff) {
      return response.status(401).json({
        success: false,
        message: 'Invalid token - staff not found'
      });
    }

    // Check if staff is active
    if (!staff.isActive) {
      return response.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Add staff to request object
    request.staff = staff;
    request.userRole = staff.role;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Staff authentication error:', error);
    return response.status(500).json({
      success: false,
      message: 'Internal server error during authentication'
    });
  }
};

// Role-based authorization middleware
const authorize = (...allowedRoles) => {
  return (request, response, next) => {
    if (!request.staff) {
      return response.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(request.staff.role)) {
      return response.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

// Check for specific permission
const checkPermission = (requiredPermission) => {
  return (request, response, next) => {
    if (!request.staff) {
      return response.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super Admin has full access
    if (request.staff.role === 'super_admin' || request.staff.systemRole === 'super_admin') {
      return next();
    }

    // Check if user has the specific permission
    if (request.staff.permissions && request.staff.permissions.includes(requiredPermission)) {
      return next();
    }

    return response.status(403).json({
      success: false,
      message: `Access denied. Missing permission: ${requiredPermission}`
    });
  };
};

// Get Staff Profile
const getStaffProfile = async (request, response) => {
  try {
    const staff = await Staff.findById(request.staff._id).select('-password');
    response.status(200).json({
      success: true,
      user: staff
    });
  } catch (error) {
    console.error('Get staff profile error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update Staff Profile
const updateStaffProfile = async (request, response) => {
  try {
    const {
      firstName,
      lastName,
      phoneNumber,
      profileImage,
      dateOfBirth,
      address,
      documents,
      currentPassword,
      newPassword
    } = request.body;

    // Use findById to trigger 'save' middleware if needed, or findOneAndUpdate
    const staff = await Staff.findById(request.staff._id);

    if (!staff) {
      return response.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    if (currentPassword && newPassword) {
      const isMatch = await staff.comparePassword(currentPassword);
      if (!isMatch) {
        return response.status(400).json({ success: false, message: 'Invalid current password' });
      }
      staff.password = newPassword;
    } else if (newPassword) {
      // Direct password overwrite (e.g. from super admin or Profile primary form)
      staff.password = newPassword;
    }

    if (firstName) staff.firstName = firstName;
    if (lastName) staff.lastName = lastName;
    if (phoneNumber) staff.phoneNumber = phoneNumber;
    if (profileImage) staff.profileImage = profileImage;
    if (dateOfBirth) staff.dateOfBirth = dateOfBirth;
    if (address) staff.address = { ...staff.address, ...address };
    if (documents) staff.documents = { ...staff.documents, ...documents };

    await staff.save();

    response.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: staff.toJSON()
    });
  } catch (error) {
    console.error('Update staff profile error:', error);

    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
// Verify Current Password
const verifyPassword = async (request, response) => {
  try {
    const { password } = request.body;

    if (!password) {
      return response.status(400).json({ success: false, message: 'Password is required for verification' });
    }

    const staff = await Staff.findById(request.staff._id);
    if (!staff) {
      return response.status(404).json({ success: false, message: 'Staff not found' });
    }

    const isMatch = await staff.comparePassword(password);

    if (!isMatch) {
      return response.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    return response.status(200).json({ success: true, message: 'Password verified successfully' });
  } catch (error) {
    console.error('Verify password error:', error);
    return response.status(500).json({ success: false, message: 'Internal server error during verification' });
  }
};

module.exports = {
  authenticateStaff,
  authorize,
  checkPermission,
  getStaffProfile,
  updateStaffProfile,
  verifyPassword
};


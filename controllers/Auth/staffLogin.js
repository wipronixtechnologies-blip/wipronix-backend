const jwt = require('jsonwebtoken');
const Staff = require('../../models/Staff.model');

// Staff Login Controller
const staffLogin = async (request, response) => {
  try {
    const { email, password } = request.body;

    console.log('[staffLogin] Attempting login for:', email);

    // Validate input
    if (!email || !password) {
      console.log('[staffLogin] Missing credentials');
      return response.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find staff by email
    const staff = await Staff.findOne({ email });

    if (!staff) {
      console.log('[staffLogin] Staff not found:', email);
      return response.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('[staffLogin] Staff found:', staff.email, 'Role:', staff.role);

    // Check if staff is active
    if (!staff.isActive) {
      console.log('[staffLogin] Staff inactive:', staff.email);
      return response.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact Super Admin.'
      });
    }

    // Verify password
    console.log('[staffLogin] Verifying password...');
    const isPasswordValid = await staff.comparePassword(password);

    if (!isPasswordValid) {
      console.log('[staffLogin] Password invalid for:', email);
      return response.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login and set isActive to true
    staff.lastLogin = new Date();
    staff.isActive = true;
    await staff.save();

    // Log Activity for Super Admin audit trail
    try {
      const { logActivity } = require('../Activity/activityController');
      logActivity({
        type: 'staff_login',
        category: 'auth',
        user: staff.fullName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Staff',
        actorId: staff._id,
        actorName: staff.fullName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Staff',
        actorEmail: staff.email,
        actorRole: staff.role,
        actorDepartment: staff.department,
        action: 'Logged into staff portal',
        target: 'Staff Portal',
        ipAddress: request.ip || (request.headers && request.headers['x-forwarded-for']) || '',
        userAgent: (request.headers && request.headers['user-agent']) || ''
      }).catch(e => console.error('[staffLogin] Activity log error:', e.message));
    } catch (actErr) {
      console.warn('[staffLogin] Activity log warning:', actErr.message);
    }

    // Generate JWT token with all user information
    const token = jwt.sign(
      {
        userId: staff._id,
        email: staff.email,
        role: staff.role,
        userType: 'staff',
        firstName: staff.firstName,
        lastName: staff.lastName,
        fullName: staff.fullName
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    // Prepare user data for response (not stored in cookie anymore)
    const userData = {
      userId: staff._id,
      email: staff.email,
      role: staff.role,
      userType: 'staff',
      firstName: staff.firstName,
      lastName: staff.lastName,
      fullName: staff.fullName
    };

    // Set HTTP-only cookie for token (contains all user data)
    const isProd = process.env.NODE_ENV === 'production';
    response.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 60 * 60 * 1000 // 7 days
    });

    console.log('[staffLogin] Login successful, token generated.');

    response.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      userData,
      user: {
        id: staff._id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        fullName: staff.fullName,
        email: staff.email,
        role: staff.role,
        systemRole: staff.systemRole,
        department: staff.department,
        designation: staff.designation,
        profileImage: staff.profileImage,
        permissions: staff.permissions
      }
    });

  } catch (error) {
    console.error('[staffLogin] CRITICAL ERROR:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error during login',
      error: error.message // Return specific error to client for debugging
    });
  }
};

module.exports = staffLogin;


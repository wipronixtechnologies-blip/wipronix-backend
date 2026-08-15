// Staff Logout Controller
const staffLogout = async (request, response) => {
  try {
    // Clear the token cookie
    response.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'development',
      sameSite: 'strict'
    });

    response.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Staff logout error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};

module.exports = staffLogout;


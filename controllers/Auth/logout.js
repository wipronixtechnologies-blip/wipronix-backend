const logout = async (request, response, next) => {
  try {
    // Clear the cookie
    const isProd = process.env.NODE_ENV === 'production';
    response.clearCookie('token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax'
    });

    response.status(200).json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};

module.exports = logout;


const getProfile = async (request, response, next) => {
  try {
    // Student is already attached to request by authenticate middleware
    const student = request.student;

    response.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        student
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error while fetching profile'
    });
  }
};

module.exports = getProfile;


const Staff = require('../../models/Staff.model');

// Get staff for dropdown (reporting to)
exports.getStaffForDropdown = async (req, res) => {
  try {
    const staff = await Staff.find({ isActive: true })
      .select('fullName email department designation')
      .sort({ fullName: 1 });

    res.status(200).json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error('Error fetching staff for dropdown:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff',
      error: error.message
    });
  }
};

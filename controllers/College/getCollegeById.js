const College = require('../../models/College.model');

const getCollegeById = async (req, res) => {
  try {
    const { id } = req.params;

    const college = await College.findById(id);

    if (!college) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'College fetched successfully',
      data: { college }
    });
  } catch (error) {
    console.error('Error fetching college:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch college',
      error: error.message
    });
  }
};

module.exports = getCollegeById;


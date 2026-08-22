const CourseOption = require('../../models/CourseOption.model');

const deleteCourseOption = async (req, res) => {
  try {
    const { id } = req.params;

    const option = await CourseOption.findById(id);
    if (!option) {
      return res.status(404).json({
        success: false,
        message: 'Course / Degree option not found'
      });
    }

    await CourseOption.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Course / Degree option deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting Course / Degree option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete Course / Degree option',
      error: error.message
    });
  }
};

module.exports = deleteCourseOption;

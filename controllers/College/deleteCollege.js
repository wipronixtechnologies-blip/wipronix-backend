const College = require('../../models/College.model');

const deleteCollege = async (req, res) => {
  try {
    const { id } = req.params;

    const college = await College.findByIdAndDelete(id);

    if (!college) {
      return res.status(404).json({
        success: false,
        message: 'College not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'College deleted successfully',
      data: { id }
    });
  } catch (error) {
    console.error('Error deleting college:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete college',
      error: error.message
    });
  }
};

module.exports = deleteCollege;


const HighestEducation = require('../../models/HighestEducation.model');

const deleteHighestEducation = async (req, res) => {
  try {
    const { id } = req.params;

    const option = await HighestEducation.findById(id);
    if (!option) {
      return res.status(404).json({
        success: false,
        message: 'Highest Education option not found'
      });
    }

    await HighestEducation.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Highest Education option deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting Highest Education option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete Highest Education option',
      error: error.message
    });
  }
};

module.exports = deleteHighestEducation;

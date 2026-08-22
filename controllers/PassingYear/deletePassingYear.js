const PassingYear = require('../../models/PassingYear.model');

const deletePassingYear = async (req, res) => {
  try {
    const { id } = req.params;

    const option = await PassingYear.findById(id);
    if (!option) {
      return res.status(404).json({
        success: false,
        message: 'Passing Year option not found'
      });
    }

    await PassingYear.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Passing Year option deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting Passing Year option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete Passing Year option',
      error: error.message
    });
  }
};

module.exports = deletePassingYear;

const HighestEducation = require('../../models/HighestEducation.model');

const updateHighestEducation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    const option = await HighestEducation.findById(id);
    if (!option) {
      return res.status(404).json({
        success: false,
        message: 'Highest Education option not found'
      });
    }

    if (name && name.trim() && name.trim() !== option.name) {
      const existingOption = await HighestEducation.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
      });
      if (existingOption) {
        return res.status(400).json({
          success: false,
          message: 'Another Highest Education option with this name already exists'
        });
      }
      option.name = name.trim();
    }

    if (isActive !== undefined) {
      option.isActive = isActive;
    }

    await option.save();

    res.status(200).json({
      success: true,
      message: 'Highest Education option updated successfully',
      data: option
    });
  } catch (error) {
    console.error('Error updating Highest Education option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Highest Education option',
      error: error.message
    });
  }
};

module.exports = updateHighestEducation;

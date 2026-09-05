const CourseOption = require('../../models/CourseOption.model');

const updateCourseOption = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, highestEducation, isActive } = req.body;

    const option = await CourseOption.findById(id);
    if (!option) {
      return res.status(404).json({
        success: false,
        message: 'Course / Degree option not found'
      });
    }

    const targetEducation = highestEducation !== undefined ? highestEducation.trim() : (option.highestEducation || 'B.Tech');

    if (name && name.trim() && (name.trim() !== option.name || targetEducation !== option.highestEducation)) {
      const existingOption = await CourseOption.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        highestEducation: targetEducation
      });
      if (existingOption) {
        return res.status(400).json({
          success: false,
          message: `Another Course / Degree option with this name already exists under ${targetEducation}`
        });
      }
      option.name = name.trim();
    }

    if (highestEducation !== undefined) {
      option.highestEducation = targetEducation;
    }

    if (isActive !== undefined) {
      option.isActive = isActive;
    }

    await option.save();

    res.status(200).json({
      success: true,
      message: 'Course / Degree option updated successfully',
      data: option
    });
  } catch (error) {
    console.error('Error updating Course / Degree option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Course / Degree option',
      error: error.message
    });
  }
};

module.exports = updateCourseOption;

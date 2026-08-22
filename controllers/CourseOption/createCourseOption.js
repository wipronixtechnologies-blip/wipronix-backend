const CourseOption = require('../../models/CourseOption.model');

const createCourseOption = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const existingOption = await CourseOption.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existingOption) {
      return res.status(400).json({
        success: false,
        message: 'This Course / Degree option already exists'
      });
    }

    const newOption = new CourseOption({
      name: name.trim()
    });

    await newOption.save();

    res.status(201).json({
      success: true,
      message: 'Course / Degree option created successfully',
      data: newOption
    });
  } catch (error) {
    console.error('Error creating Course / Degree option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Course / Degree option',
      error: error.message
    });
  }
};

module.exports = createCourseOption;

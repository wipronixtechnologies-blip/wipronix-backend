const CourseOption = require('../../models/CourseOption.model');

const getAllCourseOption = async (req, res) => {
  try {
    let options = await CourseOption.find().sort({ createdAt: 1 });
    
    // Seed default values if the collection is empty
    if (options.length === 0) {
      const defaults = [
        "Full Stack",
        "Frontend",
        "Backend",
        "Data Science",
        "DevOps",
        "Mobile Development"
      ];
      const seedPromises = defaults.map(name => new CourseOption({ name }).save());
      await Promise.all(seedPromises);
      options = await CourseOption.find().sort({ createdAt: 1 });
    }

    res.status(200).json({
      success: true,
      message: 'Course / Degree options fetched successfully',
      data: options
    });
  } catch (error) {
    console.error('Error fetching Course / Degree options:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Course / Degree options',
      error: error.message
    });
  }
};

module.exports = getAllCourseOption;

const CourseOption = require('../../models/CourseOption.model');

const getAllCourseOption = async (req, res) => {
  try {
    const { highestEducation } = req.query;
    let filter = {};
    if (highestEducation && highestEducation.trim()) {
      filter = {
        $or: [
          { highestEducation: { $regex: new RegExp(`^${highestEducation.trim()}$`, 'i') } },
          { highestEducation: "All" },
          { highestEducation: { $exists: false } },
          { highestEducation: null },
          { highestEducation: "" }
        ]
      };
    }

    let options = await CourseOption.find(filter).sort({ createdAt: 1 });
    
    // Seed default values if the collection is empty
    if (options.length === 0 && (!highestEducation || /b\.?\s*tech/i.test(highestEducation))) {
      const totalCount = await CourseOption.countDocuments();
      if (totalCount === 0) {
        const defaults = [
          "Computer Science & Engineering",
          "Information Technology",
          "Electronics & Communication",
          "Mechanical Engineering",
          "Civil Engineering",
          "Full Stack",
          "Frontend",
          "Backend",
          "Data Science",
          "DevOps",
          "Mobile Development"
        ];
        const seedPromises = defaults.map(name => new CourseOption({ name, highestEducation: 'B.Tech' }).save());
        await Promise.all(seedPromises);
        options = await CourseOption.find(filter).sort({ createdAt: 1 });
      }
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

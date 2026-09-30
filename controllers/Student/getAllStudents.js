const Student = require("../../models/Student.model");
const College = require("../../models/College.model");

const getAllStudents = async (req, res, next) => {
  try {
    let query = {};

    // Filter by assigned college or directly assigned leads if the user is a BDE
    if (req.staff.role === 'bde') {
      const assignedColleges = await College.find({ assignedTo: req.staff._id });
      const collegeNames = assignedColleges.map(c => c.name);

      query.$or = [{ assignedTo: req.staff._id }];
      if (collegeNames.length > 0) {
        query.$or.push({ college: { $in: collegeNames } });
      }
    }

    // Fetch students based on query (excluding sensitive/heavy fields with lean for fast memory performance)
    const students = await Student.find(query)
      .populate('assignedTo', 'fullName email profileImage')
      .select("-password -resetPasswordToken -resetPasswordExpires")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      message: "Students retrieved successfully",
      data: {
        students
      }
    });

  } catch (error) {
    console.error('Get all students error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching students"
    });
  }
};

module.exports = getAllStudents;

const Student = require("../../models/Student.model");

const getStudentByEmail = async (req, res, next) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email parameter is required"
      });
    }

    // Find student by email (case-insensitive)
    const student = await Student.findOne({ 
      email: email.toLowerCase().trim() 
    }).select('-password -resetPasswordToken -resetPasswordExpires');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found with this email address"
      });
    }

    res.status(200).json({
      success: true,
      message: "Student details retrieved successfully",
      data: {
        student
      }
    });

  } catch (error) {
    console.error('Get student by email error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching student details"
    });
  }
};

module.exports = getStudentByEmail;

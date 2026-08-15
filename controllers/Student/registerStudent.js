const Student = require("../../models/Student.model");
const { logActivity } = require("../Activity/activityController");

const registerStudent = async (req, res, next) => {
  try {
    const { name, email, college, semester, batch, testId } = req.body;

    if (!name || !email || !college || !semester || !batch || !testId) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const alreadyExists = await Student.findOne({ email, testId });

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: "Student already registered for this test"
      });
    }

    const student = await Student.create({
      fullName: name, // Using fullName as per model
      email,
      college,
      semester,
      batch,
      testId
    });

    // Log Activity
    logActivity({
      type: 'enrollment',
      user: name,
      action: 'enrolled in',
      target: testId, // Ideally this would be a course name, but we have testId
      metadata: { studentId: student._id, college }
    }).catch(err => console.error('Activity log error:', err));

    res.status(201).json({
      success: true,
      studentId: student._id,
      message: "Student registered successfully"
    });

  } catch (error) {
    next(error);
  }
};

module.exports = registerStudent;

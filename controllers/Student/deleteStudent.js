const mongoose = require("mongoose");
const Student = require("../../models/Student.model");
const StudentInteraction = require("../../models/StudentInteraction.model");
const Result = require("../../models/Result.model");
const TestSession = require("../../models/TestSession.model");

/**
 * Delete a single student lead by email or ID
 */
const deleteStudentByEmail = async (req, res) => {
  try {
    const email = req.query.email || req.body.email;
    const studentId = req.query.id || req.body.id || req.params.id;

    if (!email && !studentId) {
      return res.status(400).json({
        success: false,
        message: "Student email or ID is required for deletion"
      });
    }

    const query = {};
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      query._id = new mongoose.Types.ObjectId(studentId);
    } else if (email) {
      query.email = email.trim().toLowerCase();
    }

    const student = await Student.findOne(query);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student lead not found"
      });
    }

    // Clean up associated interactions
    try {
      await StudentInteraction.deleteMany({ student: student._id });
    } catch (e) {
      console.warn("Failed to clean up interactions for student:", e.message);
    }

    // Clean up test sessions & results if any
    try {
      await Result.deleteMany({
        $or: [
          { studentId: student._id },
          { studentId: String(student._id) },
          { studentEmail: student.email }
        ]
      });
      await TestSession.deleteMany({
        $or: [
          { studentId: student._id },
          { studentId: String(student._id) },
          { studentEmail: student.email }
        ]
      });
    } catch (e) {
      console.warn("Failed to clean up test sessions/results:", e.message);
    }

    // Delete the student record
    await Student.findByIdAndDelete(student._id);

    return res.status(200).json({
      success: true,
      message: `Lead ${student.fullName} (${student.email}) deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete student lead"
    });
  }
};

/**
 * Bulk delete students by array of IDs or emails
 */
const bulkDeleteStudents = async (req, res) => {
  try {
    const { studentIds, emails } = req.body;

    const idsToDelete = [];
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      for (const id of studentIds) {
        if (mongoose.Types.ObjectId.isValid(id)) {
          idsToDelete.push(new mongoose.Types.ObjectId(id));
        }
      }
    }

    const emailsToDelete = [];
    if (Array.isArray(emails) && emails.length > 0) {
      for (const email of emails) {
        if (typeof email === "string" && email.trim()) {
          emailsToDelete.push(email.trim().toLowerCase());
        }
      }
    }

    if (idsToDelete.length === 0 && emailsToDelete.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid studentIds or emails to delete"
      });
    }

    const filterConditions = [];
    if (idsToDelete.length > 0) {
      filterConditions.push({ _id: { $in: idsToDelete } });
    }
    if (emailsToDelete.length > 0) {
      filterConditions.push({ email: { $in: emailsToDelete } });
    }

    // Find matching students to capture their IDs and emails for cleanup
    const matchingStudents = await Student.find({ $or: filterConditions }).select("_id email");
    const foundIds = matchingStudents.map(s => s._id);
    const foundEmails = matchingStudents.map(s => s.email).filter(Boolean);

    if (foundIds.length > 0) {
      try {
        await StudentInteraction.deleteMany({ student: { $in: foundIds } });
      } catch (e) {
        console.warn("Error cleaning up bulk student interactions:", e.message);
      }

      try {
        const idStrings = foundIds.map(id => String(id));
        await Result.deleteMany({
          $or: [
            { studentId: { $in: foundIds } },
            { studentId: { $in: idStrings } },
            { studentEmail: { $in: foundEmails } }
          ]
        });
        await TestSession.deleteMany({
          $or: [
            { studentId: { $in: foundIds } },
            { studentId: { $in: idStrings } },
            { studentEmail: { $in: foundEmails } }
          ]
        });
      } catch (e) {
        console.warn("Error cleaning up bulk test results/sessions:", e.message);
      }
    }

    // Delete the students
    const deleteResult = await Student.deleteMany({ $or: filterConditions });

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} lead(s)`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (error) {
    console.error("Error in bulkDeleteStudents:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to bulk delete leads"
    });
  }
};

module.exports = {
  deleteStudentByEmail,
  bulkDeleteStudents
};

const mongoose = require("mongoose");
const Result = require("../../models/Result.model");
const Student = require("../../models/Student.model");
const TestSession = require("../../models/TestSession.model");
const { escapeRegex } = require("../../utils/regexUtils");

/**
 * Superadmin-only: Edit a candidate's email address on their test result and linked student profile.
 * Only Super Admin is authorized to perform this update.
 */
const updateCandidateEmail = async (req, res) => {
  try {
    // 1. Strict Super Admin role verification
    const requestingRole = (req.staff?.role || '').toLowerCase();
    const requestingSystemRole = (req.staff?.systemRole || '').toLowerCase();
    const requestingEmail = (req.staff?.email || '').toLowerCase();
    const isSuperAdmin = requestingRole === 'super_admin' || requestingRole === 'superadmin' ||
                         requestingSystemRole === 'super_admin' || requestingSystemRole === 'superadmin' ||
                         requestingEmail === 'wipronixtechnologies@gmail.com';

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Super Admin has permission to edit candidate email addresses."
      });
    }

    const resultId = req.params.resultId || req.body.resultId;
    const newEmail = req.body.newEmail || req.body.email;

    if (!resultId) {
      return res.status(400).json({
        success: false,
        message: "Result ID is required."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(resultId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Result ID format."
      });
    }

    if (!newEmail || typeof newEmail !== 'string' || !newEmail.trim()) {
      return res.status(400).json({
        success: false,
        message: "New email address is required."
      });
    }

    const cleanNewEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanNewEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format. Please provide a valid email address (e.g. name@example.com)."
      });
    }

    // 2. Locate target test result
    const result = await Result.findById(resultId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Candidate result record not found."
      });
    }

    const oldEmail = (result.studentEmail || '').trim().toLowerCase();

    // 3. Update Result record
    result.studentEmail = cleanNewEmail;
    await result.save();

    // 4. Update matching results for same student if applicable
    if (result.studentId) {
      await Result.updateMany(
        { studentId: result.studentId, _id: { $ne: result._id } },
        { $set: { studentEmail: cleanNewEmail } }
      );
    }

    // 5. Update Student profile if present
    if (result.studentId && mongoose.Types.ObjectId.isValid(String(result.studentId))) {
      await Student.findByIdAndUpdate(result.studentId, {
        $set: { email: cleanNewEmail }
      });
    } else if (oldEmail) {
      await Student.updateMany(
        { email: { $regex: new RegExp(`^${escapeRegex(oldEmail)}$`, 'i') } },
        { $set: { email: cleanNewEmail } }
      );
    }

    // 6. Update TestSession records if present
    if (oldEmail) {
      await TestSession.updateMany(
        { email: { $regex: new RegExp(`^${escapeRegex(oldEmail)}$`, 'i') } },
        { $set: { email: cleanNewEmail } }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Candidate email updated to "${cleanNewEmail}" successfully!`,
      data: {
        resultId: result._id,
        studentName: result.studentName,
        oldEmail,
        newEmail: cleanNewEmail
      }
    });

  } catch (error) {
    console.error("Error updating candidate email:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update candidate email."
    });
  }
};

module.exports = updateCandidateEmail;

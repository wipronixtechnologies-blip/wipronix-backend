const mongoose = require("mongoose");
const Result = require("../../models/Result.model");
const Student = require("../../models/Student.model");
const TestSession = require("../../models/TestSession.model");
const redis = require("../../src/config/redis");

/**
 * Superadmin-only: Permanently delete a candidate's test record from the database.
 * This completely purges Result, Student (for test), and TestSession records, plus Redis cache,
 * so the student can re-register and retake the placement drive assessment cleanly without
 * encountering duplicate email/phone constraints.
 */
const deleteCandidateResult = async (req, res, next) => {
  try {
    // 1. Strict Super Admin role verification
    const requestingRole = (req.staff?.role || '').toLowerCase();
    const requestingSystemRole = (req.staff?.systemRole || '').toLowerCase();
    const isSuperAdmin = requestingRole === 'super_admin' || requestingRole === 'superadmin' ||
                         requestingSystemRole === 'super_admin' || requestingSystemRole === 'superadmin';

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Super Admin has permission to delete candidate test records."
      });
    }

    const { resultId } = req.params;
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

    // 2. Locate target test result
    const result = await Result.findById(resultId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Candidate result record not found."
      });
    }

    const studentEmail = result.studentEmail ? result.studentEmail.trim().toLowerCase() : "";
    const studentPhone = result.studentPhone ? result.studentPhone.trim() : "";
    const eventCode = result.eventCode ? result.eventCode.trim().toUpperCase() : "";
    const rawStudentId = result.studentId ? String(result.studentId).trim() : "";
    const candidateName = result.studentName || "Candidate";

    // 3. Purge matching Result document(s)
    const resultDeleteConditions = [{ _id: result._id }];
    if (rawStudentId && rawStudentId !== 'undefined' && rawStudentId !== 'null') {
      resultDeleteConditions.push({ studentId: rawStudentId });
      if (mongoose.Types.ObjectId.isValid(rawStudentId) && rawStudentId.length === 24) {
        resultDeleteConditions.push({ studentId: new mongoose.Types.ObjectId(rawStudentId) });
      }
    }
    if (eventCode && (studentEmail || studentPhone)) {
      const emailPhoneConditions = [];
      if (studentEmail) emailPhoneConditions.push({ studentEmail });
      if (studentPhone) emailPhoneConditions.push({ studentPhone });
      resultDeleteConditions.push({
        eventCode,
        $or: emailPhoneConditions
      });
    }

    const deleteResultSummary = await Result.deleteMany({ $or: resultDeleteConditions });

    // 4. Purge or reset Student document(s) to free email and phone
    let deletedStudentCount = 0;
    const studentDeleteConditions = [];
    if (rawStudentId && mongoose.Types.ObjectId.isValid(rawStudentId) && rawStudentId.length === 24) {
      studentDeleteConditions.push({ _id: new mongoose.Types.ObjectId(rawStudentId) });
    }
    if (studentEmail) {
      studentDeleteConditions.push({ email: studentEmail });
    }
    if (studentPhone) {
      studentDeleteConditions.push({ phoneNumber: studentPhone });
    }

    if (studentDeleteConditions.length > 0) {
      const deleteStudentSummary = await Student.deleteMany({ $or: studentDeleteConditions });
      deletedStudentCount = deleteStudentSummary.deletedCount || 0;
    }

    // 5. Purge active TestSession in MongoDB (if any)
    let deletedSessionCount = 0;
    try {
      const sessionConditions = [];
      if (rawStudentId && mongoose.Types.ObjectId.isValid(rawStudentId) && rawStudentId.length === 24) {
        sessionConditions.push({ studentId: new mongoose.Types.ObjectId(rawStudentId) });
      }
      if (eventCode) {
        sessionConditions.push({ testId: eventCode });
      }
      if (sessionConditions.length > 0) {
        const delSessionRes = await TestSession.deleteMany({ $or: sessionConditions });
        deletedSessionCount = delSessionRes.deletedCount || 0;
      }
    } catch (sessionErr) {
      console.warn("[SuperAdmin Delete] TestSession cleanup error:", sessionErr.message);
    }

    // 6. Evict active Redis sessions (test:session:*)
    try {
      if (redis && redis.status === 'ready' && typeof redis.del === 'function') {
        const keysToDel = [];
        if (rawStudentId) keysToDel.push(`test:session:${rawStudentId}`);
        if (result._id) keysToDel.push(`test:session:${result._id}`);
        if (keysToDel.length > 0) {
          await redis.del(...keysToDel);
        }
      }
    } catch (redisErr) {
      console.warn("[SuperAdmin Delete] Redis cache eviction warning:", redisErr.message);
    }

    console.log(`[SuperAdmin Delete] Permanently purged record for candidate: "${candidateName}" (email: ${studentEmail}, phone: ${studentPhone}) by staff: ${req.staff?.email || req.staff?._id}`);

    return res.status(200).json({
      success: true,
      message: `Candidate record for "${candidateName}" has been permanently deleted from database. The student can now register and give the test again.`,
      deleted: {
        resultsCount: deleteResultSummary.deletedCount || 1,
        studentsCount: deletedStudentCount,
        sessionsCount: deletedSessionCount
      }
    });

  } catch (error) {
    console.error("[SuperAdmin Delete] Error deleting candidate record:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to permanently delete candidate record."
    });
  }
};

module.exports = deleteCandidateResult;

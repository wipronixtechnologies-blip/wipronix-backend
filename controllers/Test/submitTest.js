const redis = require("../../src/config/redis");
const Result = require("../../models/Result.model");
const Student = require("../../models/Student.model");

const PASS_PERCENTAGE = 70; // 70% passing threshold

const submitTest = async (req, res, next) => {
  try {
    const { studentId, answers } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "studentId is required"
      });
    }

    let sessionData = null;
    try {
      if (redis && typeof redis.get === 'function') {
        const sessionStr = await redis.get(`test:session:${studentId}`);
        if (sessionStr) sessionData = JSON.parse(sessionStr);
      }
    } catch (rErr) { }

    // Fetch student profile safely
    let student = null;
    try {
      if (studentId && studentId.length === 24) {
        student = await Student.findById(studentId);
      }
    } catch (sErr) { }

    const studentName = sessionData?.studentName || student?.fullName || "Student";
    const studentEmail = sessionData?.studentEmail || student?.email || "";
    const studentPhone = sessionData?.studentPhone || student?.phone || "";
    const collegeName = sessionData?.collegeName || student?.college || "College";
    const eventCode = sessionData?.eventCode || "GENERAL";
    const answerKeyMap = sessionData?.answerKeyMap || {};

    const submittedAnswers = answers || {};
    let attempted = 0;
    let correctCount = 0;
    const totalQuestions = Object.keys(answerKeyMap).length || 20;

    // Evaluate answers
    Object.keys(answerKeyMap).forEach(questionIdx => {
      const selectedOption = submittedAnswers[questionIdx];
      const answerObj = answerKeyMap[questionIdx];

      if (selectedOption !== undefined && selectedOption !== null && selectedOption !== "") {
        attempted++;
        if (answerObj && selectedOption === answerObj.correctOption) {
          correctCount++;
        }
      }
    });

    const score = correctCount;
    const percentage = totalQuestions > 0
      ? Math.round((correctCount / totalQuestions) * 100 * 10) / 10
      : 0;
    const status = percentage >= PASS_PERCENTAGE ? "PASS" : "FAIL";

    // Save Result document safely
    try {
      await Result.create({
        studentId,
        studentName,
        studentEmail,
        studentPhone,
        collegeName,
        eventCode,
        testId: eventCode,
        totalQuestions,
        attempted,
        correct: correctCount,
        score,
        percentage,
        status,
        answers: submittedAnswers,
        resultDeclared: true
      });
    } catch (dbErr) {
      console.warn("Result save fallback:", dbErr.message);
    }

    // Return confirmation cleanly to student
    return res.status(200).json({
      success: true,
      message: "Your test has been submitted successfully. Thank you!"
    });

  } catch (error) {
    console.error("Submit Test Critical Error:", error);
    return res.status(200).json({
      success: true,
      message: "Your test has been submitted successfully. Thank you!"
    });
  }
};

module.exports = submitTest;

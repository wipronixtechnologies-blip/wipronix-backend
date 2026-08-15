const redis = require("../../src/config/redis");
const Question = require("../../models/Question.model");
const Result = require("../../models/Result.model");
const TestSession = require("../../models/TestSession.model");
const Student = require("../../models/Student.model");
const { sendTestCompletionEmail } = require("../../src/services/emailService");

const submitTest = async (req, res, next) => {
  try {
    const { studentId, testId } = req.body;

    if (!studentId || !testId) {
      return res.status(400).json({
        success: false,
        message: "studentId and testId are required"
      });
    }

    // 🔒 Prevent double submit
    const submitLockKey = `test:submit:${studentId}`;
    const locked = await redis.set(submitLockKey, "1", "NX", "EX", 30);
    if (!locked) {
      return res.status(409).json({
        success: false,
        message: "Test already submitted"
      });
    }

    // 1️⃣ Fetch answers from Redis
    const answerKey = `test:answers:${studentId}`;
    const answers = await redis.hgetall(answerKey);

    // 2️⃣ Fetch correct answers from Mongo
    const questions = await Question.find({ testId }).select("correctAnswer");

    let correct = 0;
    let attempted = Object.keys(answers).length;

    questions.forEach((q, index) => {
      if (answers[index] !== undefined) {
        if (Number(answers[index]) === q.correctAnswer) {
          correct++;
        }
      }
    });

    const totalQuestions = questions.length;
    const score = correct; // (change logic if negative marking)

    // 3️⃣ Save result in Mongo
    const result = await Result.create({
      studentId,
      testId,
      totalQuestions,
      attempted,
      correct,
      score,
      answers
    });

    // 4️⃣ Update test session
    await TestSession.findOneAndUpdate(
      { studentId, status: "STARTED" },
      { status: "SUBMITTED" }
    );

    // 5️⃣ Cleanup Redis
    await redis.del(
      `test:session:${studentId}`,
      `test:answers:${studentId}`,
      `test:order:${studentId}`
    );

    // 6️⃣ Send completion email (async, non-blocking)
    try {
      // Fetch student details for email
      const student = await Student.findById(studentId);
      if (student && student.email) {
        // Send email asynchronously after response
        setImmediate(async () => {
          try {
            await sendTestCompletionEmail(student, {});
            console.log(`Test completion email initiated for student ${studentId}`);
          } catch (emailError) {
            console.error('Failed to send test completion email:', emailError);
          }
        });
      }
    } catch (emailError) {
      console.error('Email preparation error:', emailError);
      // Don't fail the test submission if email preparation fails
    }

    res.json({
      success: true,
      message: "Test submitted successfully",
      result: {
        totalQuestions,
        attempted,
        correct,
        score
      }
    });

    // 7️⃣ Log Activity (After response)
    try {
      const student = await Student.findById(studentId);
      if (student) {
        const { logActivity } = require("../Activity/activityController");
        logActivity({
          type: 'completion',
          user: student.fullName,
          action: 'completed',
          target: testId,
          metadata: { studentId, score, totalQuestions }
        }).catch(err => console.error('Activity log error:', err));
      }
    } catch (logError) {
      console.error('Activity logging error:', logError);
    }

  } catch (error) {
    next(error);
  }
};

module.exports = submitTest;

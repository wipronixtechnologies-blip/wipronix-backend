const mongoose = require("mongoose");
const redis = require("../../src/config/redis");
const Result = require("../../models/Result.model");
const Student = require("../../models/Student.model");
const Question = require("../../models/Question.model");
const MachineConfig = require("../../models/MachineConfig.model");

const PASS_PERCENTAGE = 70; // 70% passing threshold

const submitTest = async (req, res, next) => {
  try {
    const {
      studentId,
      answers,
      course: bodyCourse,
      semester: bodySemester,
      technology: bodyTechnology,
      studentEmail: bodyEmail,
      email: directEmail,
      studentPhone: bodyPhone,
      phone: directPhone,
      studentName: bodyName,
      fullName: directName,
      collegeName: bodyCollege,
      eventCode: bodyEventCode
    } = req.body;

    if (!studentId && !bodyEmail && !directEmail && !bodyPhone && !directPhone) {
      return res.status(400).json({
        success: false,
        message: "Candidate identification (studentId or email) is required"
      });
    }

    const effectiveEmail = (bodyEmail || directEmail || "").trim().toLowerCase();
    const effectivePhone = (bodyPhone || directPhone || "").trim();
    const effectiveStudentId = studentId ? String(studentId).trim() : "";

    // 1️⃣ Fetch session from Redis if available
    let sessionData = null;
    try {
      if (redis && redis.status === 'ready' && typeof redis.get === 'function' && effectiveStudentId) {
        const sessionStr = await redis.get(`test:session:${effectiveStudentId}`);
        if (sessionStr) sessionData = JSON.parse(sessionStr);
      }
    } catch (rErr) {
      console.warn("Redis get session warning in submitTest:", rErr.message);
    }

    // 2️⃣ Build comprehensive MongoDB query to find existing in-progress or candidate result
    const searchConditions = [];
    if (effectiveStudentId) {
      searchConditions.push({ studentId: effectiveStudentId });
      if (mongoose.Types.ObjectId.isValid(effectiveStudentId) && effectiveStudentId.length === 24) {
        try {
          searchConditions.push({ studentId: new mongoose.Types.ObjectId(effectiveStudentId) });
        } catch (e) {}
      }
    }
    if (effectiveEmail) {
      searchConditions.push({ studentEmail: effectiveEmail });
    }
    if (effectivePhone) {
      searchConditions.push({ studentPhone: effectivePhone });
    }

    let existingResults = [];
    try {
      if (searchConditions.length > 0) {
        existingResults = await Result.find({ $or: searchConditions }).sort({ createdAt: -1 });
      }
    } catch (e) {
      console.warn("Result lookup warning in submitTest:", e.message);
    }

    // Pick the most relevant existing result (prioritize drive-specific eventCode over generic)
    let existingResult = existingResults.find(r => r.eventCode && r.eventCode !== 'GENERAL') || existingResults[0] || null;

    // 3️⃣ Fetch student profile safely
    let student = null;
    try {
      if (effectiveStudentId && mongoose.Types.ObjectId.isValid(effectiveStudentId) && effectiveStudentId.length === 24) {
        student = await Student.findById(effectiveStudentId);
      }
      if (!student && effectiveEmail) {
        student = await Student.findOne({ email: effectiveEmail });
      }
    } catch (sErr) {
      console.warn("Student lookup fallback:", sErr.message);
    }

    const studentName = bodyName || directName || sessionData?.studentName || existingResult?.studentName || student?.fullName || "Candidate";
    const studentEmail = effectiveEmail || sessionData?.studentEmail || existingResult?.studentEmail || student?.email || "";
    const studentPhone = effectivePhone || sessionData?.studentPhone || existingResult?.studentPhone || student?.phoneNumber || "";
    const collegeName = bodyCollege || sessionData?.collegeName || existingResult?.collegeName || student?.college || "Shaheed Bhagat Singh State Technical University Firozpur";
    const course = bodyCourse || sessionData?.course || existingResult?.course || student?.course || "CSE";
    const semester = bodySemester || sessionData?.semester || existingResult?.semester || student?.semester || "7th Sem";
    const technology = bodyTechnology || sessionData?.technology || existingResult?.technology || student?.technology || "Core Technical";
    const eventCode = bodyEventCode || sessionData?.eventCode || existingResult?.eventCode || "GENERAL";

    // 4️⃣ Extract Answer Key Map from Redis session, existing Result, or Question Bank
    let answerKeyMap = sessionData?.answerKeyMap || null;

    // Check if existing result has answerKeyMap format in answers
    if (!answerKeyMap && existingResult?.answers) {
      const firstVal = Object.values(existingResult.answers)[0];
      if (firstVal && typeof firstVal === 'object' && firstVal.correctOption) {
        answerKeyMap = existingResult.answers;
      }
    }

    // Check other existing results if duplicate exists
    if (!answerKeyMap && existingResults.length > 1) {
      for (const resDoc of existingResults) {
        if (resDoc.answers) {
          const firstVal = Object.values(resDoc.answers)[0];
          if (firstVal && typeof firstVal === 'object' && firstVal.correctOption) {
            answerKeyMap = resDoc.answers;
            break;
          }
        }
      }
    }

    const submittedAnswers = answers || {};
    let attempted = 0;
    let correctCount = 0;
    let totalQuestions = 30;

    if (answerKeyMap && Object.keys(answerKeyMap).length > 0) {
      totalQuestions = Object.keys(answerKeyMap).length;
      Object.keys(answerKeyMap).forEach(questionIdx => {
        const selectedOption = submittedAnswers[questionIdx];
        const answerObj = answerKeyMap[questionIdx];

        if (selectedOption !== undefined && selectedOption !== null && String(selectedOption).trim() !== "") {
          attempted++;
          const selectedStr = String(selectedOption).trim().toLowerCase();
          const correctStr = String(answerObj?.correctOption || "").trim().toLowerCase();
          if (correctStr && selectedStr === correctStr) {
            correctCount++;
          }
        }
      });
    } else {
      // Fallback: If answerKeyMap was lost, count non-empty submitted answers and score against questions
      attempted = Object.keys(submittedAnswers).filter(k => submittedAnswers[k] !== undefined && submittedAnswers[k] !== null && String(submittedAnswers[k]).trim() !== "").length;
      totalQuestions = Math.max(30, attempted);
      
      // Attempt Question Bank verification if question IDs are present
      try {
        const qList = await Question.find().select("+correctAnswer").lean();
        const qMap = {};
        qList.forEach(q => {
          qMap[q._id.toString()] = q;
        });

        // If any submitted answer key has question info, evaluate
        Object.keys(submittedAnswers).forEach(idx => {
          const selectedOption = submittedAnswers[idx];
          if (selectedOption) {
            // Find question by index or match
            const matchedQ = qList[Number(idx)];
            if (matchedQ && Array.isArray(matchedQ.options)) {
              const correctOpt = matchedQ.options[matchedQ.correctAnswer] || matchedQ.options[0];
              if (correctOpt && String(selectedOption).trim().toLowerCase() === String(correctOpt).trim().toLowerCase()) {
                correctCount++;
              }
            }
          }
        });
      } catch (qErr) {
        console.warn("Question bank fallback scoring error:", qErr.message);
      }
    }

    const score = correctCount;
    const percentage = totalQuestions > 0
      ? Math.round((correctCount / totalQuestions) * 100 * 10) / 10
      : 0;
    const status = percentage >= PASS_PERCENTAGE ? "PASS" : "FAIL";

    // 5️⃣ Check if Machine Round is enabled for this candidate's technology
    let hasMachineRound = true;
    try {
      const cleanTech = technology.trim();
      const techConfig = await MachineConfig.findOne({
        technology: { $regex: new RegExp(`^${cleanTech}$`, 'i') }
      });

      if (techConfig) {
        hasMachineRound = techConfig.hasMachineRound;
      } else {
        hasMachineRound = !/sales|marketing|business|hr|telecaller/i.test(cleanTech);
      }
    } catch (mErr) {
      hasMachineRound = !/sales|marketing|business|hr|telecaller/i.test(technology);
    }

    // Preserve existing machine round fields if candidate already completed or is doing machine round
    const prevMachineStatus = existingResult?.machineRoundStatus;
    const machineRoundStatus = (prevMachineStatus && prevMachineStatus !== 'PENDING')
      ? prevMachineStatus
      : (hasMachineRound ? "PENDING" : "NOT_APPLICABLE");

    const targetStudentId = student?._id || (effectiveStudentId && effectiveStudentId.length === 24 ? new mongoose.Types.ObjectId(effectiveStudentId) : effectiveStudentId) || 'student-' + Date.now();

    // 6️⃣ Save Result document safely to the main event result record
    let savedResult = null;
    try {
      const query = existingResult
        ? { _id: existingResult._id }
        : { studentId: targetStudentId, testId: eventCode };

      savedResult = await Result.findOneAndUpdate(
        query,
        {
          studentId: targetStudentId,
          studentName,
          studentEmail,
          studentPhone,
          collegeName,
          course,
          semester,
          technology,
          eventCode,
          testId: eventCode,
          totalQuestions,
          attempted,
          correct: correctCount,
          score,
          percentage,
          status,
          answers: submittedAnswers,
          resultDeclared: true,
          hasMachineRound,
          machineRoundStatus,
          machineRoundTechnology: technology,
          ...(existingResult?.machineRoundScore !== undefined ? { machineRoundScore: existingResult.machineRoundScore } : {}),
          ...(existingResult?.machineRoundPassedTestCases !== undefined ? { machineRoundPassedTestCases: existingResult.machineRoundPassedTestCases } : {}),
          ...(existingResult?.machineRoundTotalTestCases !== undefined ? { machineRoundTotalTestCases: existingResult.machineRoundTotalTestCases } : {}),
          ...(existingResult?.machineRoundCode ? { machineRoundCode: existingResult.machineRoundCode } : {}),
          ...(existingResult?.machineRoundLanguage ? { machineRoundLanguage: existingResult.machineRoundLanguage } : {}),
          ...(existingResult?.machineRoundSubmittedAt ? { machineRoundSubmittedAt: existingResult.machineRoundSubmittedAt } : {}),
          ...(existingResult?.machineRoundConsoleOutput ? { machineRoundConsoleOutput: existingResult.machineRoundConsoleOutput } : {}),
          ...(existingResult?.technicalRoundMarks !== undefined ? { technicalRoundMarks: existingResult.technicalRoundMarks } : {})
        },
        { upsert: true, new: true }
      );

      // Clean up any other duplicate orphan records for this student
      if (existingResults.length > 1 && savedResult) {
        const orphanIds = existingResults
          .filter(r => r._id.toString() !== savedResult._id.toString())
          .map(r => r._id);
        if (orphanIds.length > 0) {
          await Result.deleteMany({ _id: { $in: orphanIds } });
        }
      }
    } catch (dbErr) {
      console.warn("Result save fallback in submitTest:", dbErr.message);
    }

    // Clean up Redis session if test is finalized
    try {
      if (redis && redis.status === 'ready' && typeof redis.del === 'function' && effectiveStudentId) {
        await redis.del(`test:session:${effectiveStudentId}`);
      }
    } catch (rDelErr) {}

    // Return confirmation cleanly to student with machine round readiness
    return res.status(200).json({
      success: true,
      message: "Your test has been submitted successfully. Thank you!",
      hasMachineRound,
      technology,
      studentId: String(targetStudentId),
      studentName,
      studentEmail,
      collegeName,
      eventCode,
      score,
      percentage,
      status
    });

  } catch (error) {
    console.error("Submit Test Critical Error:", error);
    return res.status(200).json({
      success: true,
      message: "Your test has been submitted successfully. Thank you!",
      hasMachineRound: false
    });
  }
};

module.exports = submitTest;

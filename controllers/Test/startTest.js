const redis = require("../../src/config/redis");
const TestSession = require("../../models/TestSession.model");
const Student = require("../../models/Student.model");
const Question = require("../../models/Question.model");
const EventTest = require("../../models/EventTest.model");
const Result = require("../../models/Result.model");

const TEST_DURATION_SECONDS = 20 * 60; // 20 minutes default

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Strictly normalizes questions to 4 options A, B, C, D
function normalizeOptions(rawOptions, correctIdx = 0) {
  let opts = Array.isArray(rawOptions)
    ? rawOptions.map(o => String(o || '').trim()).filter(o => o.length > 0)
    : [];

  const defaultDistractors = ['None of the above', 'All of the above', 'Both A and B', 'Cannot be determined'];

  while (opts.length < 4) {
    const fallback = defaultDistractors[opts.length] || `Option ${opts.length + 1}`;
    opts.push(fallback);
  }

  // Strictly trim to 4 options
  return opts.slice(0, 4);
}

const startTest = async (req, res, next) => {
  try {
    const { fullName, email, phone, collegeName, eventCode, course, semester, technology, studentId: providedStudentId } = req.body;

    let student = null;
    let codeToUse = (eventCode || "GENERAL").trim().toUpperCase();

    // 1️⃣ Register or update candidate in MongoDB Student collection
    try {
      if (fullName && email) {
        student = await Student.findOne({ email: email.trim().toLowerCase() });
        const courseSemesterStr = `${course || 'B.Tech'} - ${semester || 'Sem N/A'}`;

        if (!student) {
          student = await Student.create({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phoneNumber: phone ? phone.trim() : "",
            college: collegeName ? collegeName.trim() : "Default College",
            course: courseSemesterStr,
            technology: technology ? technology.trim() : ""
          });
        } else {
          if (collegeName) student.college = collegeName.trim();
          if (phone) student.phoneNumber = phone.trim();
          student.course = courseSemesterStr;
          if (technology) student.technology = technology.trim();
          await student.save();
        }
      } else if (providedStudentId && providedStudentId.length === 24) {
        student = await Student.findById(providedStudentId);
      }
    } catch (dbErr) {
      console.warn("DB Student Operation fallback:", dbErr.message);
    }

    if (!student) {
      student = {
        _id: 'temp-' + Date.now(),
        fullName: (fullName || "Candidate").trim(),
        email: (email || "candidate@wipronix.com").trim().toLowerCase(),
        phoneNumber: (phone || "").trim(),
        college: (collegeName || "Wipronix Campus Drive").trim(),
        course: `${course || 'B.Tech'} - ${semester || 'Sem N/A'}`,
        technology: technology ? technology.trim() : ""
      };
    }

    const studentIdStr = student._id.toString();


    // 2️⃣ Redis Existing Session Check
    try {
      if (redis && redis.status === 'ready' && typeof redis.get === 'function') {
        const existingSessionStr = await redis.get(`test:session:${studentIdStr}`);
        if (existingSessionStr) {
          const memData = JSON.parse(existingSessionStr);
          const elapsed = Math.floor((Date.now() - memData.startedAt) / 1000);
          if (elapsed < TEST_DURATION_SECONDS) {
            return res.status(200).json({
              success: true,
              message: "Test already in progress",
              session: {
                studentId: studentIdStr,
                studentName: student.fullName,
                email: student.email,
                collegeName: student.college,
                eventCode: memData.eventCode || codeToUse,
                durationMinutes: 20,
                remainingTimeSeconds: TEST_DURATION_SECONDS - elapsed,
                questions: memData.clientQuestions
              }
            });
          }
        }
      }
    } catch (redisErr) {
      console.warn("Redis get session error:", redisErr.message);
    }

    // 2️⃣b MongoDB Existing Result check (prevent multiple attempts by email or phone)
    try {
      if (student.email || student.phoneNumber || (phone && phone.trim())) {
        const queryOr = [];
        if (student.email) {
          queryOr.push({ studentEmail: student.email.trim().toLowerCase() });
        }
        if (student.phoneNumber) {
          queryOr.push({ studentPhone: student.phoneNumber.trim() });
        }
        if (phone && phone.trim() && phone.trim() !== student.phoneNumber?.trim()) {
          queryOr.push({ studentPhone: phone.trim() });
        }

        if (queryOr.length > 0) {
          const existingResult = await Result.findOne({
            eventCode: codeToUse,
            $or: queryOr
          });

          if (existingResult) {
            const isCompleted = existingResult.status !== 'IN_PROGRESS';
            const timeElapsedMs = Date.now() - new Date(existingResult.createdAt).getTime();
            const isExpired = timeElapsedMs >= (TEST_DURATION_SECONDS * 1000);

            if (isCompleted || isExpired) {
              return res.status(400).json({
                success: false,
                message: "You have already attempted or completed this assessment for this event. Multiple attempts are not allowed."
              });
            }
          }
        }
      }
    } catch (dbCheckErr) {
      console.error("Existing result check error:", dbCheckErr.message);
    }

    // 3️⃣ Query Questions with Caching
    let questionPool = [];
    try {
      if (redis && redis.status === 'ready' && typeof redis.get === 'function') {
        const cachedPoolStr = await redis.get("test:questionPool");
        if (cachedPoolStr) {
          questionPool = JSON.parse(cachedPoolStr);
        }
      }
    } catch (redisErr) { }

    if (!questionPool || questionPool.length === 0) {
      questionPool = await Question.find().select("+correctAnswer").lean();
      try {
        if (redis && redis.status === 'ready' && typeof redis.set === 'function' && questionPool.length > 0) {
          // Cache for 10 minutes
          await redis.set("test:questionPool", JSON.stringify(questionPool), "EX", 600);
        }
      } catch (redisErr) { }
    }

    if (!questionPool || questionPool.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No test questions found in MongoDB database. Please add questions from Admin Panel."
      });
    }

    // Filter questions based on student's technology stream in-memory
    const normalizedTech = (technology || "").trim().toLowerCase();

    let filteredQuestions = [];
    if (normalizedTech) {
      // 1. Primary: Questions matching candidate's specific technology or type
      const exactTechQuestions = questionPool.filter(
        q => (q.technology && q.technology.toLowerCase() === normalizedTech) ||
             (q.type && q.type.toLowerCase() === normalizedTech)
      );

      // 2. Secondary: Other questions available in the question pool
      const otherQuestions = questionPool.filter(
        q => (!q.technology || q.technology.toLowerCase() !== normalizedTech) &&
             (!q.type || q.type.toLowerCase() !== normalizedTech)
      );

      if (exactTechQuestions.length >= 20) {
        // We have 20 or more technology-specific questions, pick 20 from them
        filteredQuestions = shuffleArray(exactTechQuestions).slice(0, 20);
      } else if (exactTechQuestions.length > 0) {
        // Use all available tech questions and supplement up to 20 with other questions if available
        const remainingNeeded = 20 - exactTechQuestions.length;
        const sampledOther = shuffleArray(otherQuestions).slice(0, remainingNeeded);
        filteredQuestions = shuffleArray([...exactTechQuestions, ...sampledOther]);
      } else {
        // If no direct tech match, pick up to 20 from all available questions in pool
        filteredQuestions = shuffleArray(questionPool).slice(0, 20);
      }
    } else {
      // No specific technology provided, pick up to 20 questions from the pool
      filteredQuestions = shuffleArray(questionPool).slice(0, 20);
    }

    if (filteredQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No questions found in database for Technology Stream: ${technology || 'General'}. Please add questions from Admin Panel.`
      });
    }

    // 4️⃣ Randomly sample up to 20 questions from MongoDB with 4 options each
    const sampledQuestions = filteredQuestions;

    const clientQuestions = [];
    const answerKeyMap = {};

    sampledQuestions.forEach((q, index) => {
      const fourOptions = normalizeOptions(q.options, q.correctAnswer || 0);
      const correctOptionString = fourOptions[q.correctAnswer % fourOptions.length] || fourOptions[0];
      const shuffledOptions = shuffleArray(fourOptions);

      answerKeyMap[index] = {
        questionId: q._id.toString(),
        correctOption: correctOptionString
      };

      clientQuestions.push({
        id: index,
        questionId: q._id.toString(),
        question: q.question,
        codeSnippet: q.codeSnippet || "",
        options: shuffledOptions,
        type: q.type || 'technology',
        technology: q.technology || 'General'
      });
    });

    // 5️⃣ Save Session in Redis
    const startedAt = Date.now();
    const sessionData = {
      studentId: studentIdStr,
      studentName: student.fullName,
      studentEmail: student.email,
      studentPhone: student.phoneNumber || phone || "",
      collegeName: student.college || collegeName || "Default College",
      course: student.course,
      technology: student.technology || technology || "",
      eventCode: codeToUse,
      startedAt,
      answerKeyMap,
      clientQuestions
    };

    // Store candidate initial status IN_PROGRESS in MongoDB Result collection
    try {
      if (student._id && String(student._id).length === 24) {
        await Result.findOneAndUpdate(
          { studentId: student._id, testId: codeToUse },
          {
            studentId: student._id,
            studentName: student.fullName,
            studentEmail: student.email,
            studentPhone: student.phoneNumber || phone || "",
            collegeName: student.college || collegeName || "College",
            eventCode: codeToUse,
            testId: codeToUse,
            totalQuestions: sampledQuestions.length,
            status: "IN_PROGRESS",
            answers: answerKeyMap
          },
          { upsert: true, new: true }
        );
      }
    } catch (rSaveErr) {
      console.warn("Result IN_PROGRESS save warning:", rSaveErr.message);
    }

    try {
      if (redis && redis.status === 'ready' && typeof redis.set === 'function') {
        // Save for test duration + 5 minutes buffer
        await redis.set(`test:session:${studentIdStr}`, JSON.stringify(sessionData), "EX", TEST_DURATION_SECONDS + 300);
      }
    } catch (redisErr) {
      console.warn("Redis set session error:", redisErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Test started successfully",
      session: {
        studentId: studentIdStr,
        studentName: student.fullName,
        email: student.email,
        collegeName: student.college,
        course: student.course,
        technology: student.technology || technology || "",
        eventCode: codeToUse,
        durationMinutes: 20,
        remainingTimeSeconds: TEST_DURATION_SECONDS,
        questions: clientQuestions
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = startTest;

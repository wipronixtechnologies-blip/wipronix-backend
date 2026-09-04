const redis = require("../../src/config/redis");
const TestSession = require("../../models/TestSession.model");
const Student = require("../../models/Student.model");
const Question = require("../../models/Question.model");
const EventTest = require("../../models/EventTest.model");
const Result = require("../../models/Result.model");

const TEST_DURATION_SECONDS = 30 * 60; // 30 minutes (30 * 60 seconds)

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

// Category identifier helpers
function isAptitude(q) {
  const type = (q.type || '').toLowerCase();
  const tech = (q.technology || '').toLowerCase();
  return type === 'aptitude' || /aptitude|quant|reasoning|math/i.test(tech);
}

function isComputerNetwork(q) {
  const type = (q.type || '').toLowerCase();
  const tech = (q.technology || '').toLowerCase();
  return type === 'computer-network' || type === 'computer_network' || type === 'networking' || /network|networking|tcp|osi|protocol|subnet/i.test(tech);
}

function isProblemSolving(q) {
  const type = (q.type || '').toLowerCase();
  const tech = (q.technology || '').toLowerCase();
  return type === 'problem-solving' || type === 'problem_solving' || /problem\s*solving|dsa|algorithm|logic|data\s*structure/i.test(tech);
}

function isClientHandling(q) {
  const type = (q.type || '').toLowerCase();
  const tech = (q.technology || '').toLowerCase();
  return type === 'client-handling' || type === 'client_handling' || /client|customer|soft\s*skill|stakeholder|communication/i.test(tech);
}

function isTechnology(q) {
  return !isAptitude(q) && !isComputerNetwork(q) && !isProblemSolving(q) && !isClientHandling(q);
}

function getSectionName(q) {
  if (isAptitude(q)) return 'Aptitude';
  if (isComputerNetwork(q)) return 'Computer Network';
  if (isProblemSolving(q)) return 'Problem Solving';
  if (isClientHandling(q)) return 'Client Handling';
  return 'Technology';
}

const startTest = async (req, res, next) => {
  try {
    const { fullName, email, phone, collegeName, eventCode, course, semester, technology, studentId: providedStudentId } = req.body;

    let student = null;
    let codeToUse = (eventCode || "GENERAL").trim().toUpperCase();

    // 1️⃣ Register or update candidate in MongoDB Student collection
    const cleanCourse = (course || 'B.Tech').trim();
    const cleanSemester = (semester || '6th Sem').trim();
    const cleanTechnology = (technology || 'Core Technical').trim();

    try {
      if (fullName && email) {
        student = await Student.findOne({ email: email.trim().toLowerCase() });

        if (!student) {
          student = await Student.create({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phoneNumber: phone ? phone.trim() : "",
            college: collegeName ? collegeName.trim() : "Default College",
            course: cleanCourse,
            semester: cleanSemester,
            technology: cleanTechnology
          });
        } else {
          if (collegeName) student.college = collegeName.trim();
          if (phone) student.phoneNumber = phone.trim();
          student.course = cleanCourse;
          student.semester = cleanSemester;
          student.technology = cleanTechnology;
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
        course: cleanCourse,
        semester: cleanSemester,
        technology: cleanTechnology
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
                durationMinutes: 30,
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
        message: "No test questions found in database. Please add questions from Admin Panel."
      });
    }

    // 4️⃣ Strict 30-Question 5-Section Distribution:
    // 10 Technology + 5 Aptitude + 5 Computer Networks + 5 Problem Solving + 5 Client Handling = 30
    const normalizedTech = (technology || "").trim().toLowerCase();

    // 1. Technology Domain (10 Questions)
    const techPool = questionPool.filter(isTechnology);
    let selectedTech = [];
    if (normalizedTech) {
      const exactTech = techPool.filter(q => {
        const qTech = (q.technology || '').toLowerCase();
        return qTech.includes(normalizedTech) || normalizedTech.includes(qTech);
      });
      const otherTech = techPool.filter(q => !exactTech.includes(q));

      if (exactTech.length >= 10) {
        selectedTech = shuffleArray(exactTech).slice(0, 10);
      } else {
        const needed = 10 - exactTech.length;
        selectedTech = [...exactTech, ...shuffleArray(otherTech).slice(0, needed)];
      }
    } else {
      selectedTech = shuffleArray(techPool).slice(0, 10);
    }

    // Fallback if tech pool is under 10
    if (selectedTech.length < 10) {
      const remainingUnused = questionPool.filter(q => !selectedTech.includes(q));
      selectedTech = [...selectedTech, ...shuffleArray(remainingUnused).slice(0, 10 - selectedTech.length)];
    }

    // Helper to safely pick N items from category pool with fallback to unused questions
    const pickSection = (filterFn, count, alreadySelected) => {
      const pool = questionPool.filter(q => filterFn(q) && !alreadySelected.some(s => s._id.toString() === q._id.toString()));
      let chosen = shuffleArray(pool).slice(0, count);
      if (chosen.length < count) {
        const available = questionPool.filter(q =>
          !alreadySelected.some(s => s._id.toString() === q._id.toString()) &&
          !chosen.some(s => s._id.toString() === q._id.toString())
        );
        const supplement = shuffleArray(available).slice(0, count - chosen.length);
        chosen = [...chosen, ...supplement];
      }
      return chosen;
    };

    // 2. Aptitude (5 Questions)
    const selectedApt = pickSection(isAptitude, 5, selectedTech);

    // 3. Computer Networks (5 Questions)
    const selectedCN = pickSection(isComputerNetwork, 5, [...selectedTech, ...selectedApt]);

    // 4. Problem Solving (5 Questions)
    const selectedPS = pickSection(isProblemSolving, 5, [...selectedTech, ...selectedApt, ...selectedCN]);

    // 5. Client Handling (5 Questions)
    const selectedCH = pickSection(isClientHandling, 5, [...selectedTech, ...selectedApt, ...selectedCN, ...selectedPS]);

    // Combine 30 questions
    const sampledQuestions = [
      ...selectedTech,
      ...selectedApt,
      ...selectedCN,
      ...selectedPS,
      ...selectedCH
    ];

    if (sampledQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No questions found in database. Please add questions from Admin Panel.`
      });
    }

    const clientQuestions = [];
    const answerKeyMap = {};

    sampledQuestions.forEach((q, index) => {
      const fourOptions = normalizeOptions(q.options, q.correctAnswer || 0);
      const correctOptionString = fourOptions[q.correctAnswer % fourOptions.length] || fourOptions[0];
      const shuffledOptions = shuffleArray(fourOptions);
      const sectionName = getSectionName(q);

      answerKeyMap[index] = {
        questionId: q._id.toString(),
        correctOption: correctOptionString,
        section: sectionName
      };

      clientQuestions.push({
        id: index,
        questionId: q._id.toString(),
        question: q.question,
        codeSnippet: q.codeSnippet || "",
        options: shuffledOptions,
        type: q.type || 'technology',
        technology: q.technology || 'General',
        section: sectionName
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
      course: student.course || cleanCourse,
      semester: student.semester || cleanSemester,
      technology: student.technology || cleanTechnology,
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
            course: student.course || cleanCourse,
            semester: student.semester || cleanSemester,
            technology: student.technology || cleanTechnology,
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
        // Save for test duration (30m) + 5 minutes buffer
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
        course: student.course || cleanCourse,
        semester: student.semester || cleanSemester,
        technology: student.technology || cleanTechnology,
        eventCode: codeToUse,
        durationMinutes: 30,
        remainingTimeSeconds: TEST_DURATION_SECONDS,
        questions: clientQuestions
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = startTest;

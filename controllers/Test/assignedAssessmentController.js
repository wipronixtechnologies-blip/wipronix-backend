const mongoose = require("mongoose");
const Student = require("../../models/Student.model");
const Question = require("../../models/Question.model");
const Result = require("../../models/Result.model");
const MachineConfig = require("../../models/MachineConfig.model");
const redis = require("../../src/config/redis");
const { escapeRegex } = require("../../utils/regexUtils");

const TEST_DURATION_SECONDS = 30 * 60; // 30 minutes
const PASS_PERCENTAGE = 50; // 50% passing threshold for organic leads

// Fisher-Yates array shuffler
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Normalize options to exactly 4 options
function normalizeOptions(rawOptions, correctIdx = 0) {
  let opts = Array.isArray(rawOptions)
    ? rawOptions.map(o => String(o || '').trim()).filter(o => o.length > 0)
    : [];

  const defaultDistractors = ['None of the above', 'All of the above', 'Both A and B', 'Cannot be determined'];
  while (opts.length < 4) {
    const fallback = defaultDistractors[opts.length] || `Option ${opts.length + 1}`;
    opts.push(fallback);
  }
  return opts.slice(0, 4);
}

// Category identifier helpers
function isAptitude(q) {
  const type = (q.type || '').toLowerCase();
  const tech = (q.technology || '').toLowerCase();
  return type === 'aptitude' || /aptitude|quant|reasoning|math/i.test(tech);
}

function isClientHandling(q) {
  const type = (q.type || '').toLowerCase();
  const tech = (q.technology || '').toLowerCase();
  return type === 'client-handling' || type === 'client_handling' || /client|customer|soft\s*skill|stakeholder|communication/i.test(tech);
}

function isTechnology(q) {
  return !isAptitude(q) && !isClientHandling(q);
}

// Domain identifier & matcher helper
function isDomainMatch(studentTech, questionTech) {
  const s = (studentTech || '').toLowerCase().trim();
  const q = (questionTech || '').toLowerCase().trim();
  if (!s || !q) return false;

  // Direct substring / exact match
  if (q.includes(s) || s.includes(q)) return true;

  // Comprehensive Domain Groups
  const domainGroups = [
    {
      aliases: ['mern', 'react', 'node', 'express', 'mongodb', 'full stack', 'fullstack', 'javascript', 'frontend', 'web development'],
      tags: ['mern', 'react', 'node', 'express', 'mongo', 'javascript', 'js', 'frontend', 'full stack']
    },
    {
      aliases: ['python', 'django', 'fastapi', 'flask', 'backend python'],
      tags: ['python', 'django', 'fastapi', 'flask']
    },
    {
      aliases: ['java', 'spring', 'springboot', 'spring boot', 'microservices'],
      tags: ['java', 'spring', 'microservice', 'hibernate']
    },
    {
      aliases: ['mobile', 'flutter', 'react native', 'android', 'ios', 'dart'],
      tags: ['mobile', 'flutter', 'react native', 'android', 'ios', 'dart', 'kotlin', 'swift']
    },
    {
      aliases: ['next', 'next.js', 'nextjs', 'tailwind'],
      tags: ['next', 'tailwind', 'react', 'frontend']
    },
    {
      aliases: ['ai', 'ml', 'ai / ml', 'data science', 'gen ai', 'machine learning', 'deep learning'],
      tags: ['ai', 'ml', 'data science', 'gen ai', 'neural', 'machine learning', 'nlp', 'llm']
    },
    {
      aliases: ['cloud', 'devops', 'aws', 'docker', 'kubernetes'],
      tags: ['cloud', 'devops', 'aws', 'docker', 'linux', 'kubernetes', 'ci/cd']
    },
    {
      aliases: ['cyber', 'security', 'cyber security', 'infosec', 'cybersecurity'],
      tags: ['cyber', 'security', 'penetration', 'firewall', 'encryption', 'vulnerability', 'owasp', 'cryptography']
    },
    {
      aliases: ['c++', 'cpp', 'oop', 'c / c++'],
      tags: ['c++', 'cpp', 'oop']
    },
    {
      aliases: ['ui', 'ux', 'ui/ux', 'design', 'figma'],
      tags: ['ui', 'ux', 'figma', 'design', 'wireframe']
    },
    {
      aliases: ['general', 'general technical', 'core technical', 'core', 'software engineering', 'computer science', 'cs'],
      tags: ['general', 'general technical', 'core technical', 'core', 'data structure', 'algorithm', 'dbms', 'operating system', 'sql', 'programming']
    }
  ];

  for (const group of domainGroups) {
    const studentMatches = group.aliases.some(a => s.includes(a));
    if (studentMatches) {
      const questionMatches = group.tags.some(t => q.includes(t)) || group.aliases.some(a => q.includes(a));
      if (questionMatches) return true;
    }
  }

  return false;
}

function getSectionName(q) {
  if (isAptitude(q)) return 'Aptitude';
  if (isClientHandling(q)) return 'Client Handling';
  return 'Technology';
}

/**
 * 1. Verify Assessment Session Token
 * GET /api/test/assessment/verify/:token
 */
const verifyAssessmentToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assessment token is missing."
      });
    }

    const student = await Student.findOne({ testToken: token.trim() });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Invalid assessment session. Please check your link or contact your counselor."
      });
    }

    // Check expiration (2-hour window)
    if (student.testTokenExpires && new Date() > new Date(student.testTokenExpires)) {
      if (student.testTokenStatus !== 'completed') {
        student.testTokenStatus = 'expired';
        await student.save();
      }
      return res.status(410).json({
        success: false,
        expired: true,
        message: "This assessment link has expired. Secure links are valid for 2 hours only. Please contact your counselor for a fresh link."
      });
    }

    // Check if test is already completed
    if (student.testTokenStatus === 'completed' || student.resultDeclared) {
      return res.status(200).json({
        success: true,
        alreadyCompleted: true,
        message: "You have already completed this assessment.",
        data: {
          fullName: student.fullName,
          email: student.email,
          technology: student.technology,
          score: student.testScore || 0,
          percentage: student.testPercentage || 0,
          status: student.testStatus || 'Passed',
          completedAt: student.testCompletedAt
        }
      });
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(student.testTokenExpires).getTime() - Date.now()) / 1000)
    );

    return res.status(200).json({
      success: true,
      data: {
        studentId: student._id,
        fullName: student.fullName,
        email: student.email,
        phoneNumber: student.phoneNumber,
        college: student.college || "Wipronix Technical Assessment",
        course: student.course || "B.Tech",
        semester: student.semester || "Graduate",
        technology: student.technology || "Core Technical",
        token: student.testToken,
        expiresAt: student.testTokenExpires,
        remainingSeconds
      }
    });

  } catch (error) {
    console.error("Verify assessment token error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while verifying token."
    });
  }
};

/**
 * 2. Start Assessment using Session Token (Pulls directly from Central Question Bank)
 * POST /api/test/assessment/start
 */
const startAssessmentByToken = async (req, res, next) => {
  try {
    const { token, testTrack } = req.body;

    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assessment token is required."
      });
    }

    const student = await Student.findOne({ testToken: token.trim() });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Invalid assessment session."
      });
    }

    // Check 2-hour expiration window
    if (student.testTokenExpires && new Date() > new Date(student.testTokenExpires)) {
      student.testTokenStatus = 'expired';
      await student.save();
      return res.status(410).json({
        success: false,
        expired: true,
        message: "Assessment session has expired (2-hour limit). Please request a new link from your counselor."
      });
    }

    if (student.testTokenStatus === 'completed' || student.resultDeclared) {
      return res.status(400).json({
        success: false,
        message: "You have already completed this assessment."
      });
    }

    const track = testTrack === 'non-technical' ? 'non-technical' : 'technical';
    const studentIdStr = student._id.toString();

    // 1️⃣ Check for active in-progress session in Redis or MongoDB Result
    try {
      if (redis && redis.status === 'ready' && typeof redis.get === 'function') {
        const cachedSessionStr = await redis.get(`test:session:${studentIdStr}`);
        if (cachedSessionStr) {
          const memData = JSON.parse(cachedSessionStr);
          const elapsed = Math.floor((Date.now() - memData.startedAt) / 1000);
          if (elapsed < TEST_DURATION_SECONDS) {
            return res.status(200).json({
              success: true,
              message: "Test in progress resumed",
              session: {
                studentId: studentIdStr,
                studentName: student.fullName,
                email: student.email,
                collegeName: student.college,
                technology: student.technology,
                testTrack: track,
                eventCode: "ORGANIC",
                durationMinutes: 30,
                remainingTimeSeconds: TEST_DURATION_SECONDS - elapsed,
                questions: memData.clientQuestions
              }
            });
          }
        }
      }
    } catch (rErr) {
      console.warn("Redis session check warning:", rErr.message);
    }

    // 2️⃣ Query questions directly from the Central Question Bank (Question model)
    const centralQuestions = await Question.find().select("+correctAnswer").lean();

    if (!centralQuestions || centralQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Central Question Bank is empty. Please add questions from Admin Panel."
      });
    }

    const requiredCount = 30;
    let sampledQuestions = [];

    if (track === 'non-technical') {
      // Non-Technical Track: Aptitude + Client Handling from Central Question Bank
      const aptPool = centralQuestions.filter(isAptitude);
      const chPool = centralQuestions.filter(isClientHandling);

      const halfCount = Math.floor(requiredCount / 2); // 15
      const selectedApt = shuffleArray(aptPool).slice(0, halfCount);
      const remainingNeeded = requiredCount - selectedApt.length;
      const selectedCH = shuffleArray(chPool).slice(0, remainingNeeded);

      sampledQuestions = [...selectedApt, ...selectedCH];

      // Fallback if needed
      if (sampledQuestions.length < requiredCount) {
        const remainingPool = centralQuestions.filter(q =>
          !sampledQuestions.some(s => s._id.toString() === q._id.toString()) &&
          (isAptitude(q) || isClientHandling(q) || (q.type || '').toLowerCase() === 'general')
        );
        sampledQuestions = [...sampledQuestions, ...shuffleArray(remainingPool).slice(0, requiredCount - sampledQuestions.length)];
      }
    } else {
      // Technical Track: Questions strictly filtered by candidate's locked Specialization from Central Question Bank
      const studentTech = (student.technology || '').trim().toLowerCase();
      const techPool = centralQuestions.filter(isTechnology);

      // Prioritize questions matching the student's exact specialization
      let matchedDomain = [];
      if (studentTech) {
        matchedDomain = techPool.filter(q => isDomainMatch(studentTech, q.technology));
      }

      if (matchedDomain.length >= requiredCount) {
        // Full set tailored to student's specialization
        sampledQuestions = shuffleArray(matchedDomain).slice(0, requiredCount);
      } else {
        // Take all matched domain questions
        sampledQuestions = shuffleArray(matchedDomain);
        const remainingNeeded = requiredCount - sampledQuestions.length;

        // Supplement with General Technical / Core questions from Central Question Bank
        const generalTechnicalPool = techPool.filter(q =>
          !sampledQuestions.some(s => s._id.toString() === q._id.toString()) &&
          /general|core|basic|problem\s*solving|dsa|algorithm|computer\s*network/i.test(q.technology || '')
        );

        const otherTech = techPool.filter(q =>
          !sampledQuestions.some(s => s._id.toString() === q._id.toString()) &&
          !generalTechnicalPool.some(g => g._id.toString() === q._id.toString())
        );

        const supplement = [...shuffleArray(generalTechnicalPool), ...shuffleArray(otherTech)].slice(0, remainingNeeded);
        sampledQuestions = [...sampledQuestions, ...supplement];
      }

      // Final safety guarantee
      if (sampledQuestions.length < requiredCount) {
        const remainingTech = techPool.filter(q => !sampledQuestions.some(s => s._id.toString() === q._id.toString()));
        sampledQuestions = [...sampledQuestions, ...shuffleArray(remainingTech).slice(0, requiredCount - sampledQuestions.length)];
      }
    }

    // Safety fallback
    if (sampledQuestions.length === 0) {
      sampledQuestions = shuffleArray(centralQuestions).slice(0, requiredCount);
    }

    // 3️⃣ Normalize and randomize options for each question
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
        section: sectionName,
        technology: q.technology || 'General'
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

    // 4️⃣ Store in-progress Result document in MongoDB so session & answer key are persistent
    await Result.findOneAndUpdate(
      { studentId: student._id, eventCode: 'ORGANIC' },
      {
        studentId: student._id,
        studentName: student.fullName,
        studentEmail: student.email,
        studentPhone: student.phoneNumber,
        collegeName: student.college || "Wipronix Assessment",
        course: student.course || "B.Tech",
        semester: student.semester || "Graduate",
        technology: student.technology || "Core Technical",
        eventCode: 'ORGANIC',
        testId: 'ORGANIC',
        totalQuestions: clientQuestions.length,
        status: 'IN_PROGRESS',
        answerKeyMap: answerKeyMap,
        resultDeclared: false
      },
      { upsert: true, new: true }
    );

    // 5️⃣ Cache session in Redis if available
    try {
      if (redis && redis.status === 'ready' && typeof redis.set === 'function') {
        const sessionPayload = {
          studentId: studentIdStr,
          studentName: student.fullName,
          studentEmail: student.email,
          eventCode: "ORGANIC",
          startedAt: Date.now(),
          clientQuestions,
          answerKeyMap
        };
        await redis.set(`test:session:${studentIdStr}`, JSON.stringify(sessionPayload), "EX", TEST_DURATION_SECONDS);
      }
    } catch (rErr) {
      console.warn("Redis set session warning:", rErr.message);
    }

    // 6️⃣ Mark test started in student document (preserving student.source!)
    student.testTokenStatus = 'started';
    student.testTrack = track;
    await student.save();

    return res.status(200).json({
      success: true,
      message: "Assessment started successfully",
      session: {
        studentId: studentIdStr,
        studentName: student.fullName,
        email: student.email,
        collegeName: student.college,
        course: student.course,
        semester: student.semester,
        technology: student.technology,
        testTrack: track,
        eventCode: "ORGANIC",
        durationMinutes: 30,
        remainingTimeSeconds: TEST_DURATION_SECONDS,
        questions: clientQuestions
      }
    });

  } catch (error) {
    console.error("Start assessment by token error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to start assessment."
    });
  }
};

/**
 * 3. Submit Assessment using Session Token
 * POST /api/test/assessment/submit
 */
const submitAssessmentByToken = async (req, res, next) => {
  try {
    const { token, studentId, answers } = req.body;

    let student = null;
    if (token) {
      student = await Student.findOne({ testToken: token.trim() });
    }
    if (!student && studentId) {
      student = await Student.findById(studentId);
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student session not found."
      });
    }

    const studentIdStr = student._id.toString();

    // 1️⃣ Retrieve answerKeyMap from existing in-progress Result or Redis
    let answerKeyMap = null;
    const existingResult = await Result.findOne({
      studentId: student._id,
      eventCode: 'ORGANIC'
    }).sort({ createdAt: -1 });

    if (existingResult?.answerKeyMap) {
      answerKeyMap = existingResult.answerKeyMap;
    }

    if (!answerKeyMap) {
      try {
        if (redis && redis.status === 'ready' && typeof redis.get === 'function') {
          const sessionStr = await redis.get(`test:session:${studentIdStr}`);
          if (sessionStr) {
            const memData = JSON.parse(sessionStr);
            answerKeyMap = memData.answerKeyMap;
          }
        }
      } catch (rErr) {}
    }

    // 2️⃣ Evaluate submitted answers
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
      // Fallback verification directly from Central Question Bank
      try {
        const qList = await Question.find().select("+correctAnswer").lean();
        attempted = Object.keys(submittedAnswers).filter(k => submittedAnswers[k] !== undefined && submittedAnswers[k] !== null && String(submittedAnswers[k]).trim() !== "").length;
        totalQuestions = Math.max(30, attempted);

        Object.keys(submittedAnswers).forEach(idx => {
          const selectedOption = submittedAnswers[idx];
          if (selectedOption) {
            const matchedQ = qList[Number(idx)];
            if (matchedQ && Array.isArray(matchedQ.options)) {
              const correctOpt = matchedQ.options[matchedQ.correctAnswer] || matchedQ.options[0];
              if (correctOpt && String(selectedOption).trim().toLowerCase() === String(correctOpt).trim().toLowerCase()) {
                correctCount++;
              }
            }
          }
        });
      } catch (qErr) {}
    }

    const score = correctCount;
    const percentage = totalQuestions > 0
      ? Math.round((correctCount / totalQuestions) * 100 * 10) / 10
      : 0;
    const status = percentage >= PASS_PERCENTAGE ? "Passed" : "Failed";

    // 3️⃣ Check machine round readiness
    let hasMachineRound = false;
    try {
      const cleanTech = (student.technology || '').trim();
      const techConfig = await MachineConfig.findOne({
        technology: { $regex: new RegExp(`^${escapeRegex(cleanTech)}$`, 'i') }
      });
      if (techConfig) hasMachineRound = techConfig.hasMachineRound;
    } catch (mErr) {}

    // 4️⃣ Update Result document
    const finalResult = await Result.findOneAndUpdate(
      { studentId: student._id, eventCode: 'ORGANIC' },
      {
        studentId: student._id,
        studentName: student.fullName,
        studentEmail: student.email,
        studentPhone: student.phoneNumber,
        collegeName: student.college || "Wipronix Assessment",
        course: student.course || "B.Tech",
        semester: student.semester || "Graduate",
        technology: student.technology || "Core Technical",
        eventCode: 'ORGANIC',
        testId: 'ORGANIC',
        totalQuestions,
        attempted,
        correct: correctCount,
        score,
        percentage,
        status,
        answers: submittedAnswers,
        answerKeyMap: answerKeyMap || {},
        resultDeclared: true,
        hasMachineRound,
        machineRoundStatus: hasMachineRound ? 'PENDING' : 'NOT_REQUIRED',
        machineRoundTechnology: student.technology
      },
      { upsert: true, new: true }
    );

    // 5️⃣ Update Student profile
    student.resultDeclared = true;
    student.testScore = score;
    student.testPercentage = percentage;
    student.testStatus = status;
    student.testTotalQuestions = totalQuestions;
    student.testCorrect = correctCount;
    student.testAttempted = attempted;
    student.testCompletedAt = new Date();
    student.testResultId = finalResult._id;
    student.testTokenStatus = 'completed';
    await student.save();

    // Clean up Redis session
    try {
      if (redis && redis.status === 'ready' && typeof redis.del === 'function') {
        await redis.del(`test:session:${studentIdStr}`);
      }
    } catch (rDelErr) {}

    return res.status(200).json({
      success: true,
      message: "Assessment submitted and evaluated successfully!",
      score,
      percentage,
      status,
      totalQuestions,
      correct: correctCount,
      attempted,
      hasMachineRound,
      technology: student.technology,
      studentName: student.fullName
    });

  } catch (error) {
    console.error("Submit assessment by token error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit assessment."
    });
  }
};

module.exports = {
  verifyAssessmentToken,
  startAssessmentByToken,
  submitAssessmentByToken
};

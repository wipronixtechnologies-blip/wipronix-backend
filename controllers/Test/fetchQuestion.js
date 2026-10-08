const redis = require("../../src/config/redis");
const Question = require("../../models/Question.model");
const Student = require("../../models/Student.model");

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

const fetchQuestion = async (req, res, next) => {
  try {
    const { studentId, testId, index = 0 } = req.query;

    if (!studentId || !testId) {
      return res.status(400).json({
        success: false,
        message: "studentId and testId are required"
      });
    }

    console.log(`📝 Fetching question for student: ${studentId}, test: ${testId}, index: ${index}`);

    // 1️⃣ Fetch student's technology & testTrack
    let studentTechnology = null;
    let studentTestTrack = 'technical';
    try {
      const student = await Student.findById(studentId).select("technology testTrack");
      if (student) {
        if (student.technology) studentTechnology = student.technology;
        if (student.testTrack) studentTestTrack = student.testTrack;
        console.log("✅ Student Technology:", studentTechnology, "Track:", studentTestTrack);
      } else {
        console.log("⚠️  Student not found or no technology specified");
      }
    } catch (error) {
      console.log("⚠️  Could not fetch student technology:", error.message);
    }

    // 2️⃣ Load questions from Redis cache per student
    const questionCacheKey = `test:questions:${studentId}:${testId}`;
    let questions = (redis && redis.status === 'ready') ? await redis.get(questionCacheKey) : null;

    if (!questions) {
      // FIRST TIME → LOAD FROM MONGO
      console.log("📚 Loading questions from database...");

      const normalizedTech = (studentTechnology || "").trim().toLowerCase();
      const isNonTech = studentTestTrack === 'non-technical';

      // Fetch all questions for this test or global questions or from question bank
      let foundQuestions = await Question.find({
        $or: [
          { testId },
          { eventCode: testId },
          { testId: "GLOBAL" }
        ]
      }).select("question options type technology codeSnippet").lean();

      if (!foundQuestions || foundQuestions.length === 0) {
        foundQuestions = await Question.find().select("question options type technology codeSnippet").lean();
      }

      if (!foundQuestions || foundQuestions.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No questions found in database. Please add questions from Admin Panel.`,
          details: {
            testId,
            studentTechnology,
            foundQuestions: 0
          }
        });
      }

      const functionShuffle = (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      const pickSection = (filterFn, count, alreadySelected) => {
        const pool = foundQuestions.filter(q => filterFn(q) && !alreadySelected.some(s => s._id.toString() === q._id.toString()));
        let chosen = functionShuffle(pool).slice(0, count);
        if (chosen.length < count) {
          const available = foundQuestions.filter(q =>
            !alreadySelected.some(s => s._id.toString() === q._id.toString()) &&
            !chosen.some(s => s._id.toString() === q._id.toString())
          );
          const supplement = functionShuffle(available).slice(0, count - chosen.length);
          chosen = [...chosen, ...supplement];
        }
        return chosen;
      };

      let allQuestions = [];
      const requiredCount = 30;

      if (isNonTech) {
        // Non-Technical: Aptitude + Client Handling
        const halfCount = Math.floor(requiredCount / 2);
        const selectedApt = pickSection(isAptitude, halfCount, []);
        const selectedCH = pickSection(isClientHandling, requiredCount - selectedApt.length, selectedApt);
        allQuestions = [...selectedApt, ...selectedCH];
      } else {
        // Technical: Strictly technical, prioritized by specialization
        const techPool = foundQuestions.filter(isTechnology);
        let matchedDomain = [];
        if (normalizedTech) {
          matchedDomain = techPool.filter(q => isDomainMatch(normalizedTech, q.technology));
        }

        if (matchedDomain.length >= requiredCount) {
          allQuestions = functionShuffle(matchedDomain).slice(0, requiredCount);
        } else {
          allQuestions = functionShuffle(matchedDomain);
          const remainingNeeded = requiredCount - allQuestions.length;
          const generalTechnicalPool = techPool.filter(q =>
            !allQuestions.some(s => s._id.toString() === q._id.toString()) &&
            /general|core|basic|problem\s*solving|dsa|algorithm|computer\s*network/i.test(q.technology || '')
          );
          const otherTech = techPool.filter(q =>
            !allQuestions.some(s => s._id.toString() === q._id.toString()) &&
            !generalTechnicalPool.some(g => g._id.toString() === q._id.toString())
          );
          const supplement = [...functionShuffle(generalTechnicalPool), ...functionShuffle(otherTech)].slice(0, remainingNeeded);
          allQuestions = [...allQuestions, ...supplement];
        }

        if (allQuestions.length < requiredCount) {
          const remainingTech = techPool.filter(q => !allQuestions.some(s => s._id.toString() === q._id.toString()));
          allQuestions = [...allQuestions, ...functionShuffle(remainingTech).slice(0, requiredCount - allQuestions.length)];
        }
      }

      if (allQuestions.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No questions found for Technology Stream: ${studentTechnology || 'General'}. Please add questions from Admin Panel.`,
          details: {
            testId,
            studentTechnology,
            foundQuestions: 0
          }
        });
      }

      questions = JSON.stringify(allQuestions);

      // cache for 1 hour
      if (redis && redis.status === 'ready') {
        await redis.set(questionCacheKey, questions, "EX", 3600);
      }
      console.log(`✅ Cached ${allQuestions.length} questions`);
    }

    questions = JSON.parse(questions);

    // 3️⃣ Check if test session is active (optional)
    const sessionKey = `test:session:${studentId}`;
    const session = (redis && redis.status === 'ready') ? await redis.get(sessionKey) : null;
    const remainingTimeSeconds = (session && redis && redis.status === 'ready') ? await redis.ttl(sessionKey) : 0;

    // 4️⃣ Shuffle questions per student (ONCE) - only if we have a session
    let order = null;
    if (session) {
      const orderKey = `test:order:${studentId}`;
      order = (redis && redis.status === 'ready') ? await redis.get(orderKey) : null;

      if (!order) {
        const shuffledIndexes = questions.map((_, i) => i)
          .sort(() => Math.random() - 0.5);

        if (redis && redis.status === 'ready') {
          await redis.set(
            orderKey,
            JSON.stringify(shuffledIndexes),
            "EX",
            35 * 60
          );
        }

        order = shuffledIndexes;
      } else {
        order = JSON.parse(order);
      }
    } else {
      // No session, use sequential order for preview
      order = questions.map((_, i) => i);
    }

    // 5️⃣ Get question by index
    const questionIndex = order[index];
    if (questionIndex === undefined || questionIndex >= questions.length) {
      return res.status(200).json({
        success: true,
        message: "No more questions available",
        index: Number(index),
        totalQuestions: questions.length
      });
    }

    const question = questions[questionIndex];

    // 6️⃣ Transform question for frontend compatibility (shuffle options dynamically)
    const shuffledOpts = functionShuffle(question.options || []);
    const transformedQuestion = {
      question: question.question,
      codeSnippet: question.codeSnippet || "",
      options: shuffledOpts.map((option, idx) => ({
        key: `option_${idx}`,
        text: option
      }))
    };

    // 7️⃣ Response
    res.json({
      success: true,
      index: Number(index),
      question: transformedQuestion,
      remainingTimeSeconds,
      hasActiveSession: !!session,
      totalQuestions: questions.length
    });

  } catch (error) {
    console.error("❌ Error fetching question:", error);
    next(error);
  }
};

module.exports = fetchQuestion;

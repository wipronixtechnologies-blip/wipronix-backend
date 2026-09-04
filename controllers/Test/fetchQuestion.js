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
  return !isAptitude(q) && !isComputerNetwork(q) && !isProblemSolving(q) && !isClientHandling(q);
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

    // 1️⃣ Fetch student's technology (optional for question preview)
    let studentTechnology = null;
    try {
      const student = await Student.findById(studentId).select("technology");
      if (student && student.technology) {
        studentTechnology = student.technology;
        console.log("✅ Student Technology:", studentTechnology);
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

      // 1. Technology Domain (10 Questions)
      const techPool = foundQuestions.filter(isTechnology);
      let selectedTech = [];
      if (normalizedTech) {
        const exactTech = techPool.filter(q => {
          const qTech = (q.technology || '').toLowerCase();
          return qTech.includes(normalizedTech) || normalizedTech.includes(qTech);
        });
        const otherTech = techPool.filter(q => !exactTech.includes(q));

        if (exactTech.length >= 10) {
          selectedTech = functionShuffle(exactTech).slice(0, 10);
        } else {
          const needed = 10 - exactTech.length;
          selectedTech = [...exactTech, ...functionShuffle(otherTech).slice(0, needed)];
        }
      } else {
        selectedTech = functionShuffle(techPool).slice(0, 10);
      }

      if (selectedTech.length < 10) {
        const remainingUnused = foundQuestions.filter(q => !selectedTech.includes(q));
        selectedTech = [...selectedTech, ...functionShuffle(remainingUnused).slice(0, 10 - selectedTech.length)];
      }

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

      // 2. Aptitude (5 Questions)
      const selectedApt = pickSection(isAptitude, 5, selectedTech);

      // 3. Computer Networks (5 Questions)
      const selectedCN = pickSection(isComputerNetwork, 5, [...selectedTech, ...selectedApt]);

      // 4. Problem Solving (5 Questions)
      const selectedPS = pickSection(isProblemSolving, 5, [...selectedTech, ...selectedApt, ...selectedCN]);

      // 5. Client Handling (5 Questions)
      const selectedCH = pickSection(isClientHandling, 5, [...selectedTech, ...selectedApt, ...selectedCN, ...selectedPS]);

      const allQuestions = [
        ...selectedTech,
        ...selectedApt,
        ...selectedCN,
        ...selectedPS,
        ...selectedCH
      ];

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

    // 6️⃣ Transform question for frontend compatibility
    const transformedQuestion = {
      question: question.question,
      codeSnippet: question.codeSnippet || "",
      options: question.options.map((option, idx) => ({
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

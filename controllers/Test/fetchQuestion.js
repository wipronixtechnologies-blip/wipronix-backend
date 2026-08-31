const redis = require("../../src/config/redis");
const Question = require("../../models/Question.model");
const Student = require("../../models/Student.model");

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

      let allQuestions = [];

      if (normalizedTech) {
        const exactTechQuestions = foundQuestions.filter(
          q => (q.technology && q.technology.toLowerCase() === normalizedTech) ||
               (q.type && q.type.toLowerCase() === normalizedTech)
        );
        const otherQuestions = foundQuestions.filter(
          q => (!q.technology || q.technology.toLowerCase() !== normalizedTech) &&
               (!q.type || q.type.toLowerCase() !== normalizedTech)
        );

        if (exactTechQuestions.length >= 20) {
          allQuestions = functionShuffle(exactTechQuestions).slice(0, 20);
        } else if (exactTechQuestions.length > 0) {
          const remainingNeeded = 20 - exactTechQuestions.length;
          const sampledOther = functionShuffle(otherQuestions).slice(0, remainingNeeded);
          allQuestions = functionShuffle([...exactTechQuestions, ...sampledOther]);
        } else {
          allQuestions = functionShuffle(foundQuestions).slice(0, 20);
        }
      } else {
        allQuestions = functionShuffle(foundQuestions).slice(0, 20);
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
            25 * 60
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
        key: `option_${idx}`, // Create unique key for each option
        text: option // Store the option text
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

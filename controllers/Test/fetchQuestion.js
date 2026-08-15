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
    let questions = await redis.get(questionCacheKey);

    if (!questions) {
      // FIRST TIME → LOAD FROM MONGO
      console.log("📚 Loading questions from database...");
      
      const query = { testId };
      if (studentTechnology) {
        query.$or = [
          { type: 'aptitude' },
          { type: 'technology', technology: studentTechnology }
        ];
      } else {
        query.type = 'aptitude'; // Default to aptitude if no technology specified
      }

      const foundQuestions = await Question.find(query).select("question options type technology").limit(20);

      if (foundQuestions.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No questions found for this test",
          details: {
            testId,
            studentTechnology,
            foundQuestions: 0
          }
        });
      }

      // Separate aptitude and tech questions
      const aptitudeQuestions = foundQuestions.filter(q => q.type === 'aptitude');
      const techQuestions = foundQuestions.filter(q => q.type === 'technology' && (!studentTechnology || q.technology === studentTechnology));

      console.log(`📊 Found ${aptitudeQuestions.length} aptitude and ${techQuestions.length} tech questions`);

      // Check if we have enough questions
      if (studentTechnology && (aptitudeQuestions.length < 10 || techQuestions.length < 10)) {
        return res.status(404).json({
          success: false,
          message: `Insufficient questions available. Found ${aptitudeQuestions.length} aptitude questions and ${techQuestions.length} technology questions. Need at least 10 of each type.`,
          details: {
            aptitudeQuestions: aptitudeQuestions.length,
            techQuestions: techQuestions.length,
            required: 10,
            testId,
            studentTechnology
          }
        });
      } else if (!studentTechnology && aptitudeQuestions.length < 20) {
        return res.status(404).json({
          success: false,
          message: `Insufficient aptitude questions available. Found ${aptitudeQuestions.length}, need at least 20.`,
          details: {
            aptitudeQuestions: aptitudeQuestions.length,
            required: 20,
            testId
          }
        });
      }

      const allQuestions = [...aptitudeQuestions, ...techQuestions];
      questions = JSON.stringify(allQuestions);

      // cache for 1 hour
      await redis.set(questionCacheKey, questions, "EX", 3600);
      console.log(`✅ Cached ${allQuestions.length} questions`);
    }

    questions = JSON.parse(questions);

    // 3️⃣ Check if test session is active (optional)
    const sessionKey = `test:session:${studentId}`;
    const session = await redis.get(sessionKey);
    const remainingTimeSeconds = session ? await redis.ttl(sessionKey) : 0;

    // 4️⃣ Shuffle questions per student (ONCE) - only if we have a session
    let order = null;
    if (session) {
      const orderKey = `test:order:${studentId}`;
      order = await redis.get(orderKey);

      if (!order) {
        const shuffledIndexes = questions.map((_, i) => i)
          .sort(() => Math.random() - 0.5);

        await redis.set(
          orderKey,
          JSON.stringify(shuffledIndexes),
          "EX",
          25 * 60
        );

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

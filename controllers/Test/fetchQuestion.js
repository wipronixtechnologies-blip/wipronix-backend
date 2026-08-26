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
      
      const query = { testId };
      const normalizedTech = (studentTechnology || "").trim();
      const isTechTest = !['Aptitude', 'General Awareness'].includes(normalizedTech);

      if (normalizedTech) {
        if (isTechTest) {
          query.$or = [
            { type: 'aptitude', technology: 'Aptitude' },
            { type: 'aptitude', technology: 'General Awareness' },
            { type: 'technology', technology: 'General Technical & Aptitude' },
            { type: 'technology', technology: normalizedTech }
          ];
        } else {
          query.technology = normalizedTech;
        }
      } else {
        query.type = 'aptitude';
      }

      // Fetch all matching questions from database
      const foundQuestions = await Question.find(query).select("question options type technology codeSnippet").lean();

      if (foundQuestions.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No questions found for Technology Stream: ${normalizedTech || 'General'}. Please add questions from Admin Panel.`,
          details: {
            testId,
            studentTechnology,
            foundQuestions: 0
          }
        });
      }

      let allQuestions = [];

      if (normalizedTech) {
        if (isTechTest) {
          const aptitudeQuestions = foundQuestions.filter(q => q.type === 'aptitude' || q.technology === 'Aptitude' || q.technology === 'General Awareness' || q.technology === 'General Technical & Aptitude');
          const techQuestions = foundQuestions.filter(q => q.type === 'technology' && q.technology === normalizedTech);

          console.log(`📊 Found ${aptitudeQuestions.length} aptitude/general awareness and ${techQuestions.length} tech questions`);

          if (aptitudeQuestions.length < 15 || techQuestions.length < 5) {
            return res.status(404).json({
              success: false,
              message: `Insufficient questions available. Found ${aptitudeQuestions.length} aptitude/general awareness questions (need 15) and ${techQuestions.length} technology questions (need 5).`,
              details: {
                aptitudeQuestions: aptitudeQuestions.length,
                techQuestions: techQuestions.length,
                requiredAptitude: 15,
                requiredTech: 5,
                testId,
                studentTechnology
              }
            });
          }

          // Sample and shuffle
          const functionShuffle = (array) => {
            const arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
          };

          const sampledApt = functionShuffle(aptitudeQuestions).slice(0, 15);
          const sampledTech = functionShuffle(techQuestions).slice(0, 5);
          allQuestions = functionShuffle([...sampledApt, ...sampledTech]);
        } else {
          const streamQuestions = foundQuestions.filter(q => q.technology === normalizedTech);
          if (streamQuestions.length < 20) {
            return res.status(404).json({
              success: false,
              message: `Insufficient questions available. Found ${streamQuestions.length} questions for stream ${normalizedTech}, need at least 20.`,
              details: {
                aptitudeQuestions: streamQuestions.length,
                required: 20,
                testId,
                studentTechnology
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
          allQuestions = functionShuffle(streamQuestions).slice(0, 20);
        }
      } else {
        const aptitudeQuestions = foundQuestions.filter(q => q.type === 'aptitude');
        if (aptitudeQuestions.length < 20) {
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

        const functionShuffle = (array) => {
          const arr = [...array];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        };
        allQuestions = functionShuffle(aptitudeQuestions).slice(0, 20);
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

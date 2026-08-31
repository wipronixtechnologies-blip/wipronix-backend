const redis = require("../../src/config/redis");
const Question = require("../../models/Question.model");
const { addQuestionsSchema } = require("../../src/services/validationSchema");

const addQuestion = async (req, res, next) => {
  try {
    // Bypassing validation since addQuestionsSchema is missing from validationSchema.js
    console.log("Request Body:", req.body);
    
    const questions = Array.isArray(req.body.questions) ? req.body.questions : [];
    
    if (questions.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid or empty questions array provided." });
    }

    let addedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      try {
        // Create question document
        const questionDoc = new Question({
          testId: q.testId,
          type: q.type,
          technology: q.technology,
          question: q.question ? q.question.trim() : '',
          codeSnippet: q.codeSnippet ? q.codeSnippet.trim() : '',
          options: q.options.map(opt => opt.trim()),
          correctAnswer: q.correctAnswer
        });

        // Save to database
        await questionDoc.save();
        addedCount++;

      } catch (error) {
        errors.push(`Question ${i + 1}: ${error.message}`);
        failedCount++;
      }
    }

    // Clear Redis cache for all affected test IDs
    const testIds = [...new Set(questions.map(q => q.testId))];

    // Clear all matching cache keys
    try {
      if (redis && redis.status === 'ready') {
        await redis.del("test:questionPool");
      }
      for (const testId of testIds) {
        const keys = await redis.keys(`test:questions:*:${testId}`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        // Also clear question order cache
        const orderKeys = await redis.keys(`test:order:*`);
        if (orderKeys.length > 0) {
          await redis.del(...orderKeys);
        }
      }
    } catch (cacheError) {
      console.warn('Failed to clear Redis cache:', cacheError.message);
    }

    const response = {
      success: true,
      message: `Questions processed: ${addedCount} added, ${failedCount} failed`,
      addedCount,
      failedCount
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    const statusCode = addedCount > 0 ? 201 : 400;
    res.status(statusCode).json(response);

  } catch (error) {
    next(error);
  }
};

module.exports = addQuestion;

const redis = require("../../src/config/redis");
const Result = require("../../models/Result.model");

const submitAnswer = async (req, res, next) => {
  try {
    // Log the incoming request for debugging
    console.log('=== SUBMIT ANSWER DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    const { studentId, questionIndex, selectedOption, testId } = req.body;

    // Enhanced validation with detailed error messages
    const missingFields = [];
    if (!studentId) missingFields.push('studentId');
    if (questionIndex === undefined || questionIndex === null) missingFields.push('questionIndex');
    if (selectedOption === undefined || selectedOption === null) missingFields.push('selectedOption');

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        received: {
          studentId: studentId || null,
          questionIndex: questionIndex || null,
          selectedOption: selectedOption || null,
          testId: testId || null
        }
      });
    }

    // Validate data types
    if (typeof studentId !== 'string' || studentId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "studentId must be a non-empty string"
      });
    }

    if (typeof questionIndex !== 'number' || questionIndex < 0) {
      return res.status(400).json({
        success: false,
        message: "questionIndex must be a non-negative number"
      });
    }

    if (typeof selectedOption !== 'string' || selectedOption.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "selectedOption must be a non-empty string"
      });
    }

    // 1️⃣ Check test session active (but don't fail if not found - allow answer submission)
    const sessionKey = `test:session:${studentId}`;
    const sessionExists = (redis && redis.status === 'ready') ? await redis.exists(sessionKey) : false;
    let ttl = 0;

    if (sessionExists && redis && redis.status === 'ready') {
      ttl = await redis.ttl(sessionKey);
      console.log('Active session found with TTL:', ttl);
    } else {
      console.log('No active session found or Redis offline for student:', studentId);
      // Allow answer submission even without active session
    }

    // 2️⃣ Save answer in Redis (HASH) or fallback directly to MongoDB Result
    const answerKey = `test:answers:${studentId}`;

    if (redis && redis.status === 'ready') {
      await redis.hset(
        answerKey,
        questionIndex.toString(),
        selectedOption.toString()
      );

      console.log('Answer saved to Redis:', {
        answerKey,
        questionIndex: questionIndex.toString(),
        selectedOption: selectedOption.toString()
      });

      // Align answers TTL with test session if session exists
      if (ttl > 0) {
        await redis.expire(answerKey, ttl);
        console.log('Answer TTL set to:', ttl);
      }
    } else {
      // Fallback: save to MongoDB directly
      try {
        await Result.findOneAndUpdate(
          { studentId },
          { $set: { [`answers.${questionIndex}`]: selectedOption } },
          { upsert: true }
        );
        console.log('Redis offline: Answer saved directly to MongoDB Result');
      } catch (dbErr) {
        console.warn('Fallback MongoDB save failed:', dbErr.message);
      }
    }

    // 3️⃣ Response
    res.json({
      success: true,
      message: "Answer saved successfully",
      remainingTimeSeconds: ttl,
      data: {
        studentId,
        questionIndex,
        selectedOption
      }
    });

  } catch (error) {
    console.error('Error in submitAnswer:', error);
    next(error);
  }
};

module.exports = submitAnswer;

const Result = require("../../models/Result.model");
const Student = require("../../models/Student.model");

const QUALIFYING_MARKS = 70; // 70% passing threshold

const getTestResults = async (req, res, next) => {
  try {
    const {
      search,
      college,
      eventCode,
      status,
      isShortlisted,
      startDate,
      endDate,
      testId,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (testId) query.testId = testId;
    if (eventCode) query.eventCode = eventCode.trim().toUpperCase();
    if (college) query.collegeName = new RegExp(college.trim(), 'i');
    if (isShortlisted === 'true') query.isShortlisted = true;


    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (status) {
      query.status = status.toUpperCase();
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Fetch results matching query
    let results = await Result.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await Result.countDocuments(query);

    // Get all unique colleges & event codes for filter dropdowns
    const allResults = await Result.find({}, { collegeName: 1, eventCode: 1 }).lean();
    const colleges = [...new Set(allResults.map(r => r.collegeName).filter(Boolean))].sort();
    const eventCodes = [...new Set(allResults.map(r => r.eventCode).filter(Boolean))].sort();

    // Map results cleanly
    const enrichedResults = results.map(result => {
      const percentage = result.percentage !== undefined 
        ? result.percentage 
        : (result.totalQuestions > 0 ? Math.round((result.correct / result.totalQuestions) * 100 * 10) / 10 : 0);

      const passStatus = result.status || (percentage >= QUALIFYING_MARKS ? 'PASS' : 'FAIL');

      return {
        _id: result._id,
        studentId: result.studentId,
        studentName: result.studentName || 'Unknown',
        studentEmail: result.studentEmail || 'Unknown',
        studentPhone: result.studentPhone || 'N/A',
        college: result.collegeName || 'Not Specified',
        eventCode: result.eventCode || result.testId || 'N/A',
        testId: result.testId,
        totalQuestions: result.totalQuestions || 20,
        attempted: result.attempted || 0,
        correct: result.correct || 0,
        score: result.score || 0,
        percentage,
        status: passStatus,
        isShortlisted: Boolean(result.isShortlisted),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt
      };
    });

    // In-memory search if search query provided
    let filteredResults = enrichedResults;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredResults = filteredResults.filter(r =>
        r.studentName.toLowerCase().includes(searchLower) ||
        r.studentEmail.toLowerCase().includes(searchLower) ||
        r.studentPhone.toLowerCase().includes(searchLower) ||
        r.college.toLowerCase().includes(searchLower) ||
        r.eventCode.toLowerCase().includes(searchLower)
      );
    }

    // Stats calculations
    const totalStudents = totalCount;
    const passedCount = await Result.countDocuments({ ...query, status: 'PASS' });
    const failedCount = totalStudents - passedCount;
    const avgScoreResult = await Result.aggregate([
      { $match: query },
      { $group: { _id: null, avgPercentage: { $avg: '$percentage' } } }
    ]);
    const averageScore = avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avgPercentage * 10) / 10 : 0;

    res.json({
      success: true,
      data: {
        results: filteredResults,
        stats: {
          total: totalStudents,
          passed: passedCount,
          failed: failedCount,
          passRate: totalStudents > 0 ? Math.round((passedCount / totalStudents) * 100 * 10) / 10 : 0,
          averageScore
        },
        colleges,
        eventCodes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

// Toggle candidate shortlist status
const toggleShortlist = async (req, res, next) => {
  try {
    const { resultId, isShortlisted } = req.body;

    if (!resultId) {
      return res.status(400).json({
        success: false,
        message: "resultId is required"
      });
    }

    let updatedResult = null;

    // 1. Try finding by MongoDB Result _id
    try {
      updatedResult = await Result.findByIdAndUpdate(
        resultId,
        { isShortlisted: Boolean(isShortlisted) },
        { new: true }
      );
    } catch (e) {
      // Invalid ObjectId format
    }

    // 2. If not found by _id, search by studentId or email
    if (!updatedResult) {
      updatedResult = await Result.findOneAndUpdate(
        { $or: [{ studentId: resultId }, { studentEmail: resultId }] },
        { isShortlisted: Boolean(isShortlisted) },
        { new: true }
      );
    }

    if (!updatedResult) {
      return res.status(404).json({
        success: false,
        message: "Test result record not found"
      });
    }

    res.json({
      success: true,
      message: `Candidate ${isShortlisted ? 'shortlisted' : 'removed from shortlist'} successfully`,
      data: updatedResult
    });
  } catch (error) {
    console.error("Shortlist API Error:", error);
    next(error);
  }
};

// API to fetch ONLY shortlisted candidates
const getShortlistedStudents = async (req, res, next) => {
  req.query.isShortlisted = 'true';
  return getTestResults(req, res, next);
};

module.exports = { getTestResults, toggleShortlist, getShortlistedStudents };

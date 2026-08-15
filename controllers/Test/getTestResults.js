const Result = require("../../models/Result.model");
const Student = require("../../models/Student.model");
const College = require("../../models/College.model");

const QUALIFYING_MARKS = 70; // 70% qualifying marks

const getTestResults = async (req, res, next) => {
  try {
    const {
      search,
      college,
      status,
      startDate,
      endDate,
      testId,
      page = 1,
      limit = 10
    } = req.query;

    // Build query object
    const query = {};

    // Filter by testId if provided
    if (testId) {
      query.testId = testId;
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get all results matching the base query first
    let results = await Result.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalCount = await Result.countDocuments(query);

    // Get all students to populate student details
    const studentIds = results.map(r => r.studentId);
    const students = await Student.find({ _id: { $in: studentIds } }).lean();

    // Create a map for quick student lookup
    const studentMap = {};
    students.forEach(s => {
      studentMap[s._id.toString()] = s;
    });

    // Get all unique colleges from students
    const allStudents = await Student.find({}, { college: 1 }).lean();
    const colleges = [...new Set(allStudents.map(s => s.college).filter(Boolean))];

    // Transform results with student details and pass/fail status
    const enrichedResults = results.map(result => {
      const student = studentMap[result.studentId?.toString()] || {};
      
      // Calculate percentage
      const percentage = result.totalQuestions > 0 
        ? Math.round((result.correct / result.totalQuestions) * 100 * 10) / 10 
        : 0;
      
      // Determine pass/fail status
      const passStatus = percentage >= QUALIFYING_MARKS ? 'PASS' : 'FAIL';

      return {
        _id: result._id,
        studentId: result.studentId,
        studentName: student.fullName || 'Unknown',
        studentEmail: student.email || 'Unknown',
        college: student.college || 'Not Specified',
        course: student.course || 'N/A',
        testId: result.testId,
        totalQuestions: result.totalQuestions,
        attempted: result.attempted,
        correct: result.correct,
        score: result.score,
        percentage: percentage,
        status: passStatus,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt
      };
    });

    // Apply in-memory filters (search, college, status)
    let filteredResults = enrichedResults;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredResults = filteredResults.filter(r =>
        r.studentName.toLowerCase().includes(searchLower) ||
        r.studentEmail.toLowerCase().includes(searchLower) ||
        r.college.toLowerCase().includes(searchLower)
      );
    }

    if (college) {
      filteredResults = filteredResults.filter(r =>
        r.college.toLowerCase() === college.toLowerCase()
      );
    }

    if (status) {
      filteredResults = filteredResults.filter(r =>
        r.status.toUpperCase() === status.toUpperCase()
      );
    }

    // Calculate stats
    const totalStudents = filteredResults.length;
    const passedCount = filteredResults.filter(r => r.status === 'PASS').length;
    const failedCount = totalStudents - passedCount;
    const averageScore = totalStudents > 0
      ? Math.round((filteredResults.reduce((sum, r) => sum + r.percentage, 0) / totalStudents) * 10) / 10
      : 0;

    res.json({
      success: true,
      data: {
        results: filteredResults,
        stats: {
          total: totalStudents,
          passed: passedCount,
          failed: failedCount,
          passRate: totalStudents > 0 
            ? Math.round((passedCount / totalStudents) * 100 * 10) / 10 
            : 0,
          averageScore: averageScore
        },
        colleges: colleges.sort(),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = getTestResults;


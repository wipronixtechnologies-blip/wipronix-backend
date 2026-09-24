const mongoose = require('mongoose');
const Student = require('../../models/Student.model');
const Staff = require('../../models/Staff.model');
const College = require('../../models/College.model');
const EventTest = require('../../models/EventTest.model');
const RegistrationSlip = require('../../models/RegistrationSlip.model');
const crypto = require('crypto');
const emailService = require('../../src/services/emailService');

// 1. Get BDE Staff List with Assignment Metrics
exports.getBDEs = async (req, res) => {
  try {
    // Find all BDEs (only staff whose role/systemRole is bde or designation is BDE)
    const bdes = await Staff.find({
      $or: [
        { role: 'bde' },
        { systemRole: 'bde' },
        { designation: { $regex: /^bde\b|business development executive/i } }
      ],
      isActive: true
    }).select('firstName lastName fullName email phoneNumber department designation role systemRole profileImage createdAt');

    // Aggregate assignment counts and colleges per BDE
    const bdeIds = bdes.map(b => b._id);
    const assignmentStats = await Student.aggregate([
      {
        $match: {
          assignedTo: { $in: bdeIds }
        }
      },
      {
        $group: {
          _id: {
            bdeId: '$assignedTo',
            college: '$college',
            status: '$counselingStatus'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Build metric map for each BDE
    const bdeStatsMap = {};
    bdes.forEach(b => {
      bdeStatsMap[b._id.toString()] = {
        totalAssignedStudents: 0,
        colleges: new Set(),
        collegeBreakdown: {},
        statusBreakdown: {
          assigned: 0,
          contacted: 0,
          interested: 0,
          not_interested: 0,
          enrolled: 0,
          rejected: 0,
          other: 0
        }
      };
    });

    assignmentStats.forEach(stat => {
      const bdeId = stat._id.bdeId?.toString();
      if (bdeId && bdeStatsMap[bdeId]) {
        const count = stat.count;
        const collegeName = stat._id.college || 'Unspecified';
        const status = stat._id.status || 'assigned';

        bdeStatsMap[bdeId].totalAssignedStudents += count;
        if (stat._id.college) {
          bdeStatsMap[bdeId].colleges.add(collegeName);
          bdeStatsMap[bdeId].collegeBreakdown[collegeName] = (bdeStatsMap[bdeId].collegeBreakdown[collegeName] || 0) + count;
        }

        if (bdeStatsMap[bdeId].statusBreakdown[status] !== undefined) {
          bdeStatsMap[bdeId].statusBreakdown[status] += count;
        }
      }
    });

    const enrichedBdes = bdes.map(b => {
      const bdeObj = b.toObject();
      const stats = bdeStatsMap[b._id.toString()] || {
        totalAssignedStudents: 0,
        colleges: new Set(),
        collegeBreakdown: {},
        statusBreakdown: {}
      };

      return {
        ...bdeObj,
        totalAssignedStudents: stats.totalAssignedStudents,
        totalAssignedColleges: stats.colleges.size,
        assignedCollegesList: Array.from(stats.colleges),
        collegeBreakdown: stats.collegeBreakdown,
        statusBreakdown: stats.statusBreakdown
      };
    });

    res.status(200).json({
      success: true,
      data: enrichedBdes
    });
  } catch (error) {
    console.error('Error fetching BDEs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get College-wise Student Stats from EventTests (eventtests collection)
exports.getCollegesStudentStats = async (req, res) => {
  try {
    // 1. Fetch all events from eventtests collection
    const eventTests = await EventTest.find({}).sort({ createdAt: -1 }).lean();

    // 2. For each event in eventtests, compute total, assigned, and unassigned students
    const collegesList = await Promise.all(
      eventTests.map(async (event) => {
        const collegeName = event.collegeName?.trim() || '';
        const eventCode = event.eventCode?.trim() || '';

        // Query matching students by collegeName or eventCode/testId
        const matchCollegeFilter = {
          $or: [
            { college: { $regex: new RegExp(`^${collegeName}$`, 'i') } },
            { testId: eventCode },
            { testId: event._id.toString() }
          ]
        };

        const [totalStudents, assignedStudents, unassignedStudents, bdeBreakdown] = await Promise.all([
          Student.countDocuments(matchCollegeFilter),
          Student.countDocuments({
            $and: [
              matchCollegeFilter,
              { assignedTo: { $ne: null } }
            ]
          }),
          Student.countDocuments({
            $and: [
              matchCollegeFilter,
              { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] }
            ]
          }),
          Student.aggregate([
            {
              $match: {
                $and: [
                  matchCollegeFilter,
                  { assignedTo: { $ne: null } }
                ]
              }
            },
            {
              $group: {
                _id: '$assignedTo',
                count: { $sum: 1 }
              }
            },
            {
              $lookup: {
                from: 'staffs',
                localField: '_id',
                foreignField: '_id',
                as: 'bdeInfo'
              }
            },
            {
              $unwind: {
                path: '$bdeInfo',
                preserveNullAndEmptyArrays: true
              }
            },
            {
              $project: {
                bdeId: '$_id',
                bdeName: '$bdeInfo.fullName',
                bdeEmail: '$bdeInfo.email',
                count: 1
              }
            }
          ])
        ]);

        return {
          _id: event._id,
          eventId: event._id,
          eventCode: event.eventCode,
          testTitle: event.testTitle,
          technology: event.technology,
          eventType: event.eventType,
          conductedBy: event.conductedBy,
          collegeName: collegeName,
          totalStudents,
          assignedStudents,
          unassignedStudents,
          assignedBDEs: bdeBreakdown.map(b => ({
            bdeId: b.bdeId,
            bdeName: b.bdeName || 'BDE',
            bdeEmail: b.bdeEmail || '',
            count: b.count
          }))
        };
      })
    );

    // Sort by total students descending
    collegesList.sort((a, b) => b.totalStudents - a.totalStudents);

    res.status(200).json({
      success: true,
      data: collegesList
    });
  } catch (error) {
    console.error('Error fetching eventtests college stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2.1 Get Breakdown of Courses and Semesters with Unassigned Counts for a College/Drive
exports.getPoolBreakdown = async (req, res) => {
  try {
    const { collegeName, course, semester } = req.query;

    if (!collegeName) {
      return res.status(400).json({ success: false, message: 'collegeName is required' });
    }

    const event = await EventTest.findOne({
      $or: [
        { collegeName: { $regex: new RegExp(`^${collegeName.trim()}$`, 'i') } },
        { eventCode: collegeName.trim() }
      ]
    });

    const baseCollegeMatch = {
      $or: [
        { college: { $regex: new RegExp(`^${collegeName.trim()}$`, 'i') } },
        ...(event ? [
          { testId: event.eventCode },
          { testId: event._id.toString() },
          { college: { $regex: new RegExp(`^${event.collegeName.trim()}$`, 'i') } }
        ] : [])
      ]
    };

    const unassignedMatch = {
      $and: [
        baseCollegeMatch,
        {
          $or: [
            { assignedTo: null },
            { assignedTo: { $exists: false } }
          ]
        }
      ]
    };

    // Aggregate unique courses with total and unassigned counts
    const coursesStats = await Student.aggregate([
      { $match: baseCollegeMatch },
      {
        $group: {
          _id: { $ifNull: ['$course', 'General'] },
          total: { $sum: 1 },
          unassigned: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$assignedTo', null] },
                    { $not: ['$assignedTo'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Aggregate unique semesters with total and unassigned counts
    const semestersStats = await Student.aggregate([
      { $match: baseCollegeMatch },
      {
        $group: {
          _id: { $ifNull: ['$semester', 'General'] },
          total: { $sum: 1 },
          unassigned: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$assignedTo', null] },
                    { $not: ['$assignedTo'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Filtered count based on selected course and semester
    const filteredConditions = [
      baseCollegeMatch,
      {
        $or: [
          { assignedTo: null },
          { assignedTo: { $exists: false } }
        ]
      }
    ];

    if (course && course !== 'all' && course.trim()) {
      filteredConditions.push({
        course: { $regex: new RegExp(`^${course.trim()}$`, 'i') }
      });
    }

    if (semester && semester !== 'all' && semester.trim()) {
      filteredConditions.push({
        semester: { $regex: new RegExp(`^${semester.trim()}$`, 'i') }
      });
    }

    const [totalPool, unassignedPool, filteredUnassigned] = await Promise.all([
      Student.countDocuments(baseCollegeMatch),
      Student.countDocuments(unassignedMatch),
      Student.countDocuments({ $and: filteredConditions })
    ]);

    res.status(200).json({
      success: true,
      data: {
        collegeName,
        totalStudents: totalPool,
        unassignedStudents: unassignedPool,
        matchingUnassigned: filteredUnassigned,
        courses: coursesStats
          .filter(c => c._id && c._id.trim() !== '')
          .map(c => ({
            name: c._id,
            total: c.total,
            unassigned: c.unassigned
          })),
        semesters: semestersStats
          .filter(s => s._id && s._id.trim() !== '')
          .map(s => ({
            name: s._id,
            total: s.total,
            unassigned: s.unassigned
          }))
      }
    });
  } catch (error) {
    console.error('Error fetching pool breakdown:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Assign Students to BDE (Sequentially from unassigned pool with Course & Semester filters)
exports.assignStudents = async (req, res) => {
  try {
    const { collegeName, bdeId, count, course, semester, assignmentMode } = req.body;

    if (!collegeName) {
      return res.status(400).json({ success: false, message: 'College name is required' });
    }

    if (!bdeId) {
      return res.status(400).json({ success: false, message: 'BDE selection is required' });
    }

    // Verify BDE exists
    const bde = await Staff.findById(bdeId);
    if (!bde) {
      return res.status(404).json({ success: false, message: 'Selected BDE employee not found' });
    }

    // Find unassigned students for this college / event drive (FIFO: oldest registered first)
    const event = await EventTest.findOne({
      $or: [
        { collegeName: { $regex: new RegExp(`^${collegeName.trim()}$`, 'i') } },
        { eventCode: collegeName.trim() }
      ]
    });

    const andConditions = [
      {
        $or: [
          { college: { $regex: new RegExp(`^${collegeName.trim()}$`, 'i') } },
          ...(event ? [
            { testId: event.eventCode },
            { testId: event._id.toString() },
            { college: { $regex: new RegExp(`^${event.collegeName.trim()}$`, 'i') } }
          ] : [])
        ]
      },
      {
        $or: [
          { assignedTo: null },
          { assignedTo: { $exists: false } }
        ]
      }
    ];

    if (course && course !== 'all' && course.trim()) {
      andConditions.push({
        course: { $regex: new RegExp(`^${course.trim()}$`, 'i') }
      });
    }

    if (semester && semester !== 'all' && semester.trim()) {
      andConditions.push({
        semester: { $regex: new RegExp(`^${semester.trim()}$`, 'i') }
      });
    }

    const unassignedQuery = { $and: andConditions };

    const totalUnassigned = await Student.countDocuments(unassignedQuery);

    if (totalUnassigned === 0) {
      const filters = [];
      if (course && course !== 'all') filters.push(`Course: "${course}"`);
      if (semester && semester !== 'all') filters.push(`Semester: "${semester}"`);
      const filterStr = filters.length > 0 ? ` with ${filters.join(', ')}` : '';
      return res.status(400).json({
        success: false,
        message: `No unassigned students available for ${collegeName}${filterStr}. All matching students have already been assigned.`
      });
    }

    let numberToAssign;
    if (assignmentMode === 'all') {
      numberToAssign = totalUnassigned;
    } else {
      const assignCount = parseInt(count, 10);
      if (isNaN(assignCount) || assignCount <= 0) {
        return res.status(400).json({ success: false, message: 'Please enter a valid number of students (> 0)' });
      }
      numberToAssign = Math.min(assignCount, totalUnassigned);
    }

    // Fetch the specific student IDs to assign
    const studentsToAssign = await Student.find(unassignedQuery)
      .select('_id fullName email course semester technology')
      .sort({ createdAt: 1, _id: 1 })
      .limit(numberToAssign);

    const studentIds = studentsToAssign.map(s => s._id);

    // Update students
    await Student.updateMany(
      { _id: { $in: studentIds } },
      {
        $set: {
          assignedTo: bde._id,
          assignedBy: req.staff?._id || null,
          assignedAt: new Date(),
          counselingStatus: 'assigned'
        }
      }
    );

    const remainingUnassigned = totalUnassigned - numberToAssign;

    let filterSummary = '';
    if (course && course !== 'all' && semester && semester !== 'all') {
      filterSummary = ` (${course} - ${semester})`;
    } else if (course && course !== 'all') {
      filterSummary = ` (${course})`;
    } else if (semester && semester !== 'all') {
      filterSummary = ` (${semester})`;
    }

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${numberToAssign} student(s)${filterSummary} from ${collegeName} to ${bde.fullName}. ${remainingUnassigned} matching unassigned student(s) remain in the pool.`,
      data: {
        assignedCount: numberToAssign,
        requestedCount: count,
        remainingUnassigned,
        bdeName: bde.fullName,
        bdeEmail: bde.email,
        collegeName,
        course: course || 'all',
        semester: semester || 'all',
        assignedStudentIds: studentIds
      }
    });
  } catch (error) {
    console.error('Error assigning students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get Assigned Students with Filters & Search
exports.getAssignedStudents = async (req, res) => {
  try {
    const {
      college,
      bdeId,
      counselingStatus,
      course,
      semester,
      search,
      assignmentState, // 'assigned' | 'unassigned' | 'all'
      page = 1,
      limit = 25
    } = req.query;

    const query = {};

    if (college) {
      query.college = { $regex: new RegExp(college.trim(), 'i') };
    }

    if (course && course !== 'all' && course.trim()) {
      query.course = { $regex: new RegExp(course.trim(), 'i') };
    }

    if (semester && semester !== 'all' && semester.trim()) {
      query.semester = { $regex: new RegExp(semester.trim(), 'i') };
    }

    if (bdeId) {
      if (bdeId === 'unassigned') {
        query.$or = [{ assignedTo: null }, { assignedTo: { $exists: false } }];
      } else {
        query.assignedTo = new mongoose.Types.ObjectId(bdeId);
      }
    } else if (assignmentState === 'assigned') {
      query.assignedTo = { $ne: null };
    } else if (assignmentState === 'unassigned') {
      query.$or = [{ assignedTo: null }, { assignedTo: { $exists: false } }];
    }

    if (counselingStatus && counselingStatus !== 'all') {
      query.counselingStatus = counselingStatus;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { course: searchRegex },
        { semester: searchRegex },
        { technology: searchRegex },
        { city: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 25;
    const skip = (pageNum - 1) * limitNum;

    const [students, totalCount, distinctCourses, distinctSemesters] = await Promise.all([
      Student.find(query)
        .select('-password -resetPasswordToken -resetPasswordExpires')
        .populate('assignedTo', 'firstName lastName fullName email designation department role')
        .populate('assignedBy', 'firstName lastName fullName email designation department role')
        .populate('createdBy', 'firstName lastName fullName email designation department role')
        .sort({ assignedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Student.countDocuments(query),
      Student.distinct('course', college ? { college: { $regex: new RegExp(college.trim(), 'i') } } : {}),
      Student.distinct('semester', college ? { college: { $regex: new RegExp(college.trim(), 'i') } } : {})
    ]);

    res.status(200).json({
      success: true,
      data: {
        students,
        availableCourses: distinctCourses.filter(Boolean).sort(),
        availableSemesters: distinctSemesters.filter(Boolean).sort(),
        pagination: {
          totalCount,
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          limit: limitNum
        }
      }
    });
  } catch (error) {
    console.error('Error fetching assigned students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Unassign Students (Move back to college unassigned pool)
exports.unassignStudents = async (req, res) => {
  try {
    const { studentIds, collegeName, bdeId } = req.body;

    let filter = {};
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      filter = { _id: { $in: studentIds } };
    } else if (collegeName && bdeId) {
      const event = await EventTest.findOne({
        $or: [
          { collegeName: { $regex: new RegExp(`^${collegeName.trim()}$`, 'i') } },
          { eventCode: collegeName.trim() }
        ]
      });

      filter = {
        $and: [
          {
            $or: [
              { college: { $regex: new RegExp(`^${collegeName.trim()}$`, 'i') } },
              ...(event ? [
                { testId: event.eventCode },
                { testId: event._id.toString() },
                { college: { $regex: new RegExp(`^${event.collegeName.trim()}$`, 'i') } }
              ] : [])
            ]
          },
          { assignedTo: bdeId }
        ]
      };
    } else if (bdeId) {
      filter = { assignedTo: bdeId };
    } else {
      return res.status(400).json({ success: false, message: 'Please provide studentIds or collegeName & bdeId to unassign' });
    }

    const result = await Student.updateMany(
      filter,
      {
        $set: {
          assignedTo: null,
          assignedBy: null,
          assignedAt: null,
          counselingStatus: 'unassigned'
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `Successfully unassigned ${result.modifiedCount} student(s). They are now returned to the unassigned pool.`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error unassigning students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Reassign Students to another BDE
exports.reassignStudents = async (req, res) => {
  try {
    const { studentIds, newBdeId } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Student IDs array is required' });
    }

    if (!newBdeId) {
      return res.status(400).json({ success: false, message: 'Target BDE ID is required' });
    }

    const newBde = await Staff.findById(newBdeId);
    if (!newBde) {
      return res.status(404).json({ success: false, message: 'Target BDE not found' });
    }

    const result = await Student.updateMany(
      { _id: { $in: studentIds } },
      {
        $set: {
          assignedTo: newBde._id,
          assignedBy: req.staff?._id || null,
          assignedAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `Successfully reassigned ${result.modifiedCount} student(s) to ${newBde.fullName}.`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error reassigning students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Update Counseling Status and Notes
exports.updateCounselingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { counselingStatus, counselingNotes } = req.body;

    const updates = {};
    if (counselingStatus) updates.counselingStatus = counselingStatus;
    if (counselingNotes !== undefined) updates.counselingNotes = counselingNotes;

    const student = await Student.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .populate('assignedTo', 'fullName email designation');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Student counseling status updated',
      data: student
    });
  } catch (error) {
    console.error('Error updating counseling status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Get Counselor Overall Stats
exports.getCounselorOverview = async (req, res) => {
  try {
    const [
      totalStudents,
      assignedStudents,
      unassignedStudents,
      totalBDEs,
      statusCounts
    ] = await Promise.all([
      Student.countDocuments({}),
      Student.countDocuments({ assignedTo: { $ne: null } }),
      Student.countDocuments({ $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] }),
      Staff.countDocuments({
        $or: [
          { role: 'bde' },
          { systemRole: 'bde' },
          { designation: { $regex: /^bde\b|business development executive/i } }
        ],
        isActive: true
      }),
      Student.aggregate([
        {
          $group: {
            _id: '$counselingStatus',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const statusMap = {};
    statusCounts.forEach(s => {
      statusMap[s._id || 'unassigned'] = s.count;
    });

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        assignedStudents,
        unassignedStudents,
        totalBDEs,
        statusBreakdown: statusMap
      }
    });
  } catch (error) {
    console.error('Error fetching counselor overview:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Get My Assigned Students (For Logged-in Counselor / BDE)
exports.getMyAssignedStudents = async (req, res) => {
  try {
    const loggedInStaff = req.staff;
    if (!loggedInStaff) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Determine target counselor:
    // If admin/HR and counselorId is specified, allow switching; otherwise use logged in staff ID
    let targetStaffId = loggedInStaff._id;
    const isPrivileged = ['super_admin', 'admin', 'hr', 'hr_manager'].includes(loggedInStaff.role) ||
      ['super_admin', 'admin', 'hr', 'hr_manager'].includes(loggedInStaff.systemRole);

    if (req.query.counselorId && isPrivileged) {
      targetStaffId = req.query.counselorId;
    }

    const counselorObjectId = new mongoose.Types.ObjectId(targetStaffId);

    // Target Counselor Details
    const counselorStaff = await Staff.findById(counselorObjectId).select('firstName lastName fullName email phoneNumber department designation role systemRole profileImage');
    if (!counselorStaff) {
      return res.status(404).json({ success: false, message: 'Counselor staff record not found' });
    }

    const {
      college,
      counselingStatus,
      course,
      semester,
      search,
      page = 1,
      limit = 25,
      sortBy = 'assignedAt',
      sortOrder = 'desc'
    } = req.query;

    // Base match filter for this counselor's assignments
    const baseCounselorFilter = { assignedTo: counselorObjectId };
    const query = { ...baseCounselorFilter };

    if (college && college !== 'all') {
      query.college = { $regex: new RegExp(college.trim(), 'i') };
    }

    if (course && course !== 'all' && course.trim()) {
      query.course = { $regex: new RegExp(course.trim(), 'i') };
    }

    if (semester && semester !== 'all' && semester.trim()) {
      query.semester = { $regex: new RegExp(semester.trim(), 'i') };
    }

    if (counselingStatus && counselingStatus !== 'all') {
      query.counselingStatus = counselingStatus;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { course: searchRegex },
        { semester: searchRegex },
        { technology: searchRegex },
        { city: searchRegex },
        { college: searchRegex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortObj = {};
    if (sortBy === 'fullName') {
      sortObj.fullName = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
      sortObj.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortObj.assignedAt = sortOrder === 'asc' ? 1 : -1;
      sortObj.createdAt = -1;
    }

    // Parallel queries: Students list, Total matching, Counselor Overall Stats, Distinct Colleges, Courses & Semesters
    const [
      students,
      totalMatchingCount,
      totalAssignedCount,
      statusAggregation,
      distinctColleges,
      distinctCourses,
      distinctSemesters
    ] = await Promise.all([
      Student.find(query)
        .select('-password -resetPasswordToken -resetPasswordExpires')
        .populate('assignedTo', 'firstName lastName fullName email designation department role')
        .populate('assignedBy', 'firstName lastName fullName email designation department role')
        .populate('createdBy', 'firstName lastName fullName email designation department role')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Student.countDocuments(query),
      Student.countDocuments(baseCounselorFilter),
      Student.aggregate([
        { $match: baseCounselorFilter },
        {
          $group: {
            _id: '$counselingStatus',
            count: { $sum: 1 }
          }
        }
      ]),
      Student.distinct('college', baseCounselorFilter),
      Student.distinct('course', baseCounselorFilter),
      Student.distinct('semester', baseCounselorFilter)
    ]);

    // Build status breakdown
    const statusBreakdown = {
      assigned: 0,
      contacted: 0,
      interested: 0,
      not_interested: 0,
      enrolled: 0,
      rejected: 0,
      other: 0
    };

    statusAggregation.forEach(item => {
      const key = item._id || 'assigned';
      if (statusBreakdown[key] !== undefined) {
        statusBreakdown[key] = item.count;
      } else {
        statusBreakdown[key] = item.count;
      }
    });

    const enrolledCount = statusBreakdown.enrolled || 0;
    const conversionRate = totalAssignedCount > 0
      ? Math.round((enrolledCount / totalAssignedCount) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        counselor: counselorStaff,
        stats: {
          totalAssigned: totalAssignedCount,
          assigned: statusBreakdown.assigned || 0,
          contacted: statusBreakdown.contacted || 0,
          interested: statusBreakdown.interested || 0,
          enrolled: enrolledCount,
          not_interested: statusBreakdown.not_interested || 0,
          rejected: statusBreakdown.rejected || 0,
          other: statusBreakdown.other || 0,
          conversionRate,
          totalColleges: distinctColleges.filter(Boolean).length
        },
        colleges: distinctColleges.filter(Boolean).sort(),
        courses: distinctCourses.filter(Boolean).sort(),
        semesters: distinctSemesters.filter(Boolean).sort(),
        students,
        pagination: {
          totalCount: totalMatchingCount,
          currentPage: pageNum,
          totalPages: Math.ceil(totalMatchingCount / limitNum),
          limit: limitNum
        }
      }
    });
  } catch (error) {
    console.error('Error fetching counselor assigned students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. Add New Student Lead (Directly by Counselor or Admin)
exports.addLead = async (req, res) => {
  try {
    const loggedInStaff = req.staff;
    if (!loggedInStaff) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const {
      fullName,
      email,
      phoneNumber,
      college,
      course,
      semester,
      technology,
      city,
      passingYear,
      counselingStatus = 'assigned',
      counselingNotes = '',
      assignedTo
    } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanTech = technology ? technology.trim() : '';

    // Determine target counselor
    let targetCounselorId = loggedInStaff._id;
    const isPrivileged = ['super_admin', 'admin', 'hr', 'hr_manager'].includes(loggedInStaff.role) ||
      ['super_admin', 'admin', 'hr', 'hr_manager'].includes(loggedInStaff.systemRole);

    if (assignedTo && isPrivileged) {
      targetCounselorId = assignedTo;
    }

    // Check if duplicate student with email exists
    const query = { email: cleanEmail };
    if (cleanTech) {
      query.technology = cleanTech;
    }

    let existingStudent = await Student.findOne(query);

    if (existingStudent) {
      if (!existingStudent.assignedTo) {
        existingStudent.fullName = fullName.trim() || existingStudent.fullName;
        if (phoneNumber) existingStudent.phoneNumber = phoneNumber.trim();
        if (college) existingStudent.college = college.trim();
        if (course) existingStudent.course = course.trim();
        if (semester) existingStudent.semester = semester.trim();
        if (city) existingStudent.city = city.trim();
        if (passingYear) existingStudent.passingYear = passingYear.toString().trim();
        existingStudent.assignedTo = targetCounselorId;
        existingStudent.assignedBy = loggedInStaff._id;
        existingStudent.createdBy = existingStudent.createdBy || loggedInStaff._id;
        existingStudent.assignedAt = new Date();
        existingStudent.counselingStatus = counselingStatus || 'assigned';
        if (counselingNotes) existingStudent.counselingNotes = counselingNotes.trim();

        await existingStudent.save();
        await existingStudent.populate('assignedTo', 'firstName lastName fullName email designation department role');
        await existingStudent.populate('assignedBy', 'firstName lastName fullName email designation department role');
        await existingStudent.populate('createdBy', 'firstName lastName fullName email designation department role');

        return res.status(200).json({
          success: true,
          message: 'Existing unassigned student lead found and assigned to counselor.',
          data: existingStudent
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `A student with this email (${cleanEmail}) is already assigned to a counselor.`
        });
      }
    }

    // Create new Student lead
    const newStudent = new Student({
      fullName: fullName.trim(),
      email: cleanEmail,
      phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
      college: college ? college.trim() : 'Direct Lead',
      course: course ? course.trim() : undefined,
      semester: semester ? semester.trim() : undefined,
      technology: cleanTech || undefined,
      city: city ? city.trim() : undefined,
      passingYear: passingYear ? passingYear.toString().trim() : undefined,
      counselingStatus: counselingStatus || 'assigned',
      counselingNotes: counselingNotes ? counselingNotes.trim() : '',
      assignedTo: targetCounselorId,
      assignedBy: loggedInStaff._id,
      createdBy: loggedInStaff._id,
      assignedAt: new Date()
    });

    await newStudent.save();
    await newStudent.populate('assignedTo', 'firstName lastName fullName email designation department role');
    await newStudent.populate('assignedBy', 'firstName lastName fullName email designation department role');
    await newStudent.populate('createdBy', 'firstName lastName fullName email designation department role');

    res.status(201).json({
      success: true,
      message: 'Student lead created and assigned successfully!',
      data: newStudent
    });
  } catch (error) {
    console.error('Error creating student lead:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateRegistrationSlip = async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      contactNo,
      email,
      address,
      technology,
      fatherName,
      duration,
      totalFee,
      paidAmount,
      dueAmount,
      paymentMode,
      nextDueDate,
      deliveryMode
    } = req.body;

    const loggedInStaff = req.user;

    // Fetch Student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Determine Installment
    const previousSlips = await RegistrationSlip.find({ student: studentId }).sort({ installmentNumber: -1 });
    const installmentNumber = previousSlips.length > 0 ? previousSlips[0].installmentNumber + 1 : 1;

    // Generate unique verification token & REG NO
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const registrationNo = req.body.registrationNo || `WPX-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newSlip = new RegistrationSlip({
      student: student._id,
      issuedBy: loggedInStaff._id,
      registrationNo,
      technology,
      duration,
      totalFee,
      paidAmount,
      dueAmount,
      paymentMode,
      nextDueDate,
      installmentNumber,
      deliveryMode,
      verificationToken,
      status: 'Pending Verification'
    });

    await newSlip.save();

    console.log("Slip saved. Sending Email via template...");

    // Now trigger Email (if email was selected or as default)
    if (deliveryMode && deliveryMode.includes('Email')) {
      const studentData = { studentName, email: email || student.email };
      const slipData = { registrationNo, technology, paidAmount, dueAmount };
      await emailService.sendRegistrationSlipEmail(studentData, slipData, verificationToken);
    }

    return res.status(200).json({
      success: true,
      message: 'Registration slip generated and sent successfully.',
      data: newSlip
    });
  } catch (error) {
    console.error('Error generating registration slip:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const mongoose = require('mongoose');
const Student = require('../../models/Student.model');
const Staff = require('../../models/Staff.model');
const College = require('../../models/College.model');
const EventTest = require('../../models/EventTest.model');
const RegistrationSlip = require('../../models/RegistrationSlip.model');
const Result = require('../../models/Result.model');
const crypto = require('crypto');
const emailService = require('../../src/services/emailService');
const { logActivity } = require('../Activity/activityController');
const { escapeRegex } = require('../../utils/regexUtils');

const isSuperAdminOrAdmin = (staff) => {
  if (!staff) return false;
  const roles = ['super_admin', 'admin', 'hr', 'hr_manager'];
  return roles.includes(staff.role) || roles.includes(staff.systemRole);
};

const isTLRole = (staff) => {
  if (!staff) return false;
  return staff.role === 'tl' || staff.systemRole === 'tl';
};

// 1. Get BDE Staff List with Assignment Metrics
exports.getBDEs = async (req, res) => {
  try {
    const isTL = isTLRole(req.staff) && !isSuperAdminOrAdmin(req.staff);
    const tlId = req.staff?._id;

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
    const matchFilter = {
      assignedTo: { $in: bdeIds }
    };

    // If TL, only count students assigned by this TL to the BDEs
    if (isTL) {
      matchFilter.assignedBy = tlId;
    }

    const assignmentStats = await Student.aggregate([
      {
        $match: matchFilter
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
    const isTL = isTLRole(req.staff) && !isSuperAdminOrAdmin(req.staff);
    const tlId = req.staff?._id;

    // 1. Fetch all events from eventtests collection
    const eventTests = await EventTest.find({}).sort({ createdAt: -1 }).lean();

    let targetEvents = eventTests;

    if (isTL) {
      // Find distinct colleges where students are assigned to this TL or assigned by this TL
      const tlCollegesList = await Student.distinct('college', {
        $or: [{ assignedTo: tlId }, { assignedBy: tlId }]
      });

      if (!tlCollegesList || tlCollegesList.length === 0) {
        return res.status(200).json({
          success: true,
          data: []
        });
      }

      const tlCollegesNormalized = tlCollegesList.map(c => (c || '').trim().toLowerCase());

      targetEvents = eventTests.filter(event => {
        const cName = (event.collegeName || '').trim().toLowerCase();
        const eCode = (event.eventCode || '').trim().toLowerCase();
        return tlCollegesNormalized.includes(cName) || tlCollegesNormalized.includes(eCode);
      });

      // If TL has assigned students in a college not listed in EventTest, add a entry for it
      const matchedCollegeNames = targetEvents.map(e => (e.collegeName || '').trim().toLowerCase());
      tlCollegesList.forEach(cName => {
        if (cName && !matchedCollegeNames.includes(cName.trim().toLowerCase())) {
          targetEvents.push({
            _id: new mongoose.Types.ObjectId(),
            eventCode: 'CAMPUS-POOL',
            testTitle: 'Allocated Student Pool',
            technology: 'Campus Leads',
            eventType: 'Allocated Leads',
            conductedBy: 'Admin Allocation',
            collegeName: cName.trim()
          });
        }
      });
    }

    // 2. For each event, compute total, assigned, and unassigned students
    const collegesList = await Promise.all(
      targetEvents.map(async (event) => {
        const collegeName = event.collegeName?.trim() || '';
        const eventCode = event.eventCode?.trim() || '';

        // Query matching students by collegeName or eventCode/testId
        const matchCollegeFilter = {
          $or: [
            { college: { $regex: new RegExp(`^${escapeRegex(collegeName)}$`, 'i') } },
            ...(eventCode ? [{ testId: eventCode }] : []),
            ...(event._id ? [{ testId: event._id.toString() }] : [])
          ]
        };

        if (isTL) {
          // For TL:
          // totalStudents: all students allocated to this TL in this college
          // assignedStudents: students delegated by this TL to counselors
          // unassignedStudents: students currently waiting with this TL to be assigned
          const [totalStudents, assignedStudents, unassignedStudents, bdeBreakdown] = await Promise.all([
            Student.countDocuments({
              $and: [
                matchCollegeFilter,
                { $or: [{ assignedTo: tlId }, { assignedBy: tlId }] }
              ]
            }),
            Student.countDocuments({
              $and: [
                matchCollegeFilter,
                { assignedBy: tlId, assignedTo: { $nin: [tlId, null] } }
              ]
            }),
            Student.countDocuments({
              $and: [
                matchCollegeFilter,
                { assignedTo: tlId }
              ]
            }),
            Student.aggregate([
              {
                $match: {
                  $and: [
                    matchCollegeFilter,
                    { assignedBy: tlId, assignedTo: { $nin: [tlId, null] } }
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
        }

        // For Super Admin / Admin: global system numbers
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

    // If TL, only show colleges where totalStudents > 0
    let resultList = collegesList;
    if (isTL) {
      resultList = collegesList.filter(c => c.totalStudents > 0);
    }

    // Sort by total students descending
    resultList.sort((a, b) => b.totalStudents - a.totalStudents);

    res.status(200).json({
      success: true,
      data: resultList
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
    const isTL = isTLRole(req.staff) && !isSuperAdminOrAdmin(req.staff);
    const tlId = req.staff?._id;

    if (!collegeName) {
      return res.status(400).json({ success: false, message: 'collegeName is required' });
    }

    const event = await EventTest.findOne({
      $or: [
        { collegeName: { $regex: new RegExp(`^${escapeRegex(collegeName.trim())}$`, 'i') } },
        { eventCode: collegeName.trim() }
      ]
    });

    const baseCollegeMatch = {
      $or: [
        { college: { $regex: new RegExp(`^${escapeRegex(collegeName.trim())}$`, 'i') } },
        ...(event ? [
          { testId: event.eventCode },
          { testId: event._id.toString() },
          { college: { $regex: new RegExp(`^${escapeRegex(event.collegeName.trim())}$`, 'i') } }
        ] : [])
      ]
    };

    // For TL: Available pool to assign = students currently assigned to this TL
    // For Admin: Available pool to assign = global unassigned students
    const unassignedMatch = isTL
      ? {
          $and: [
            baseCollegeMatch,
            { assignedTo: tlId }
          ]
        }
      : {
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

    const tlScopeMatch = isTL
      ? {
          $and: [
            baseCollegeMatch,
            { $or: [{ assignedTo: tlId }, { assignedBy: tlId }] }
          ]
        }
      : baseCollegeMatch;

    // Aggregate unique courses with total and unassigned counts
    const coursesStats = await Student.aggregate([
      { $match: tlScopeMatch },
      {
        $group: {
          _id: { $ifNull: ['$course', 'General'] },
          total: { $sum: 1 },
          unassigned: {
            $sum: {
              $cond: [
                isTL
                  ? { $eq: ['$assignedTo', tlId] }
                  : {
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
      { $match: tlScopeMatch },
      {
        $group: {
          _id: { $ifNull: ['$semester', 'General'] },
          total: { $sum: 1 },
          unassigned: {
            $sum: {
              $cond: [
                isTL
                  ? { $eq: ['$assignedTo', tlId] }
                  : {
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
      isTL
        ? { assignedTo: tlId }
        : {
            $or: [
              { assignedTo: null },
              { assignedTo: { $exists: false } }
            ]
          }
    ];

    if (course && course !== 'all' && course.trim()) {
      filteredConditions.push({
        course: { $regex: new RegExp(`^${escapeRegex(course.trim())}$`, 'i') }
      });
    }

    if (semester && semester !== 'all' && semester.trim()) {
      filteredConditions.push({
        semester: { $regex: new RegExp(`^${escapeRegex(semester.trim())}$`, 'i') }
      });
    }

    const [totalPool, unassignedPool, filteredUnassigned] = await Promise.all([
      Student.countDocuments(tlScopeMatch),
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
    const isTL = isTLRole(req.staff) && !isSuperAdminOrAdmin(req.staff);
    const tlId = req.staff?._id;

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

    // Find students for this college / event drive (FIFO: oldest registered first)
    const event = await EventTest.findOne({
      $or: [
        { collegeName: { $regex: new RegExp(`^${escapeRegex(collegeName.trim())}$`, 'i') } },
        { eventCode: collegeName.trim() }
      ]
    });

    const collegeMatch = {
      $or: [
        { college: { $regex: new RegExp(`^${escapeRegex(collegeName.trim())}$`, 'i') } },
        ...(event ? [
          { testId: event.eventCode },
          { testId: event._id.toString() },
          { college: { $regex: new RegExp(`^${escapeRegex(event.collegeName.trim())}$`, 'i') } }
        ] : [])
      ]
    };

    // For TL: can ONLY assign students currently assigned to THIS TL
    // For Admin: can assign from global unassigned pool
    const unassignCondition = isTL
      ? { assignedTo: tlId }
      : {
          $or: [
            { assignedTo: null },
            { assignedTo: { $exists: false } }
          ]
        };

    const andConditions = [
      collegeMatch,
      unassignCondition
    ];

    if (course && course !== 'all' && course.trim()) {
      andConditions.push({
        course: { $regex: new RegExp(`^${escapeRegex(course.trim())}$`, 'i') }
      });
    }

    if (semester && semester !== 'all' && semester.trim()) {
      andConditions.push({
        semester: { $regex: new RegExp(`^${escapeRegex(semester.trim())}$`, 'i') }
      });
    }

    const unassignedQuery = { $and: andConditions };

    const totalUnassigned = await Student.countDocuments(unassignedQuery);

    if (totalUnassigned === 0) {
      const filters = [];
      if (course && course !== 'all') filters.push(`Course: "${course}"`);
      if (semester && semester !== 'all') filters.push(`Semester: "${semester}"`);
      const filterStr = filters.length > 0 ? ` with ${filters.join(', ')}` : '';
      const poolType = isTL ? 'assigned to you' : 'unassigned';
      return res.status(400).json({
        success: false,
        message: `No ${poolType} students available for ${collegeName}${filterStr}. All matching students have already been assigned.`
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

    // Update students: assign to BDE, set assignedBy to the current user (TL or Admin)
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

    const successMsg = isTL
      ? `Successfully assigned ${numberToAssign} student(s)${filterSummary} from your pool (${collegeName}) to ${bde.fullName}. ${remainingUnassigned} student(s) remain in your pool.`
      : `Successfully assigned ${numberToAssign} student(s)${filterSummary} from ${collegeName} to ${bde.fullName}. ${remainingUnassigned} matching unassigned student(s) remain in the pool.`;

    res.status(200).json({
      success: true,
      message: successMsg,
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
    const isTL = isTLRole(req.staff) && !isSuperAdminOrAdmin(req.staff);
    const tlId = req.staff?._id;

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

    const andConditions = [];

    if (college) {
      andConditions.push({ college: { $regex: new RegExp(escapeRegex(college.trim()), 'i') } });
    }

    if (course && course !== 'all' && course.trim()) {
      andConditions.push({ course: { $regex: new RegExp(escapeRegex(course.trim()), 'i') } });
    }

    if (semester && semester !== 'all' && semester.trim()) {
      andConditions.push({ semester: { $regex: new RegExp(escapeRegex(semester.trim()), 'i') } });
    }

    if (isTL) {
      // Scope to this TL's students
      if (bdeId) {
        if (bdeId === 'unassigned') {
          // In TL view, unassigned means still with the TL to be assigned
          andConditions.push({ assignedTo: tlId });
        } else {
          andConditions.push({
            assignedTo: new mongoose.Types.ObjectId(bdeId),
            assignedBy: tlId
          });
        }
      } else if (assignmentState === 'assigned') {
        // Students delegated by the TL to counselors
        andConditions.push({
          assignedBy: tlId,
          assignedTo: { $nin: [tlId, null] }
        });
      } else if (assignmentState === 'unassigned') {
        // Students still in TL's available pool
        andConditions.push({ assignedTo: tlId });
      } else {
        // All students belonging to this TL
        andConditions.push({
          $or: [
            { assignedTo: tlId },
            { assignedBy: tlId }
          ]
        });
      }
    } else {
      // Super Admin / Admin view
      if (bdeId) {
        if (bdeId === 'unassigned') {
          andConditions.push({ $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] });
        } else {
          andConditions.push({ assignedTo: new mongoose.Types.ObjectId(bdeId) });
        }
      } else if (assignmentState === 'assigned') {
        andConditions.push({ assignedTo: { $ne: null } });
      } else if (assignmentState === 'unassigned') {
        andConditions.push({ $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] });
      }
    }

    const sourceParam = req.query.source;
    if (sourceParam && sourceParam !== 'all') {
      const source = sourceParam;
      if (source === 'organic') andConditions.push({ source: 'organic' });
      else if (source === 'import') andConditions.push({ source: 'import' });
      else if (source === 'test') { 
        andConditions.push({ source: { $nin: ['organic', 'import'] } }); 
      }
      else if (source === 'internship') { 
        andConditions.push({ source: { $nin: ['organic', 'import'] }, technology: { $exists: true, $ne: '' } }); 
      }
      else andConditions.push({ source: source });
    }
  
    if (counselingStatus && counselingStatus !== 'all') {
      andConditions.push({ counselingStatus });
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      andConditions.push({
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
          { course: searchRegex },
          { semester: searchRegex },
          { technology: searchRegex },
          { city: searchRegex }
        ]
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 25;
    const skip = (pageNum - 1) * limitNum;

    const distinctScope = isTL ? { $or: [{ assignedTo: tlId }, { assignedBy: tlId }] } : {};
    if (college) {
      distinctScope.college = { $regex: new RegExp(escapeRegex(college.trim()), 'i') };
    }

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
      Student.distinct('course', distinctScope),
      Student.distinct('semester', distinctScope)
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

// 5. Unassign Students (Move back to pool)
exports.unassignStudents = async (req, res) => {
  try {
    const isTL = isTLRole(req.staff) && !isSuperAdminOrAdmin(req.staff);
    const tlId = req.staff?._id;
    const { studentIds, collegeName, bdeId } = req.body;

    let filter = {};
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      filter = { _id: { $in: studentIds } };
    } else if (collegeName && bdeId) {
      const event = await EventTest.findOne({
        $or: [
          { collegeName: { $regex: new RegExp(`^${escapeRegex(collegeName.trim())}$`, 'i') } },
          { eventCode: collegeName.trim() }
        ]
      });

      filter = {
        $and: [
          {
            $or: [
              { college: { $regex: new RegExp(`^${escapeRegex(collegeName.trim())}$`, 'i') } },
              ...(event ? [
                { testId: event.eventCode },
                { testId: event._id.toString() },
                { college: { $regex: new RegExp(`^${escapeRegex(event.collegeName.trim())}$`, 'i') } }
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

    // If TL, only allow unassigning students that were assigned by this TL
    if (isTL) {
      filter.assignedBy = tlId;
    }

    // For TL: return the student back to the TL's available pool (assignedTo: tlId)
    // For Admin: return student to global unassigned pool (assignedTo: null, assignedBy: null)
    const updateFields = isTL
      ? {
          assignedTo: tlId,
          assignedAt: new Date(),
          counselingStatus: 'assigned'
        }
      : {
          assignedTo: null,
          assignedBy: null,
          assignedAt: null,
          counselingStatus: 'unassigned'
        };

    const result = await Student.updateMany(
      filter,
      {
        $set: updateFields
      }
    );

    const message = isTL
      ? `Successfully unassigned ${result.modifiedCount} student(s) and returned them to your available pool.`
      : `Successfully unassigned ${result.modifiedCount} student(s). They are now returned to the unassigned pool.`;

    res.status(200).json({
      success: true,
      message,
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

        // Authorization check for TL: TL can only re-assign students globally if they own them, OR are super admin
    let query = { _id: { $in: studentIds } };
    const isSuperAdmin = req.staff && ['super_admin', 'admin', 'hr', 'hr_manager'].includes(req.staff.role || req.staff.systemRole);
    const isTL = req.staff && (req.staff.role === 'tl' || req.staff.systemRole === 'tl');
    
    if (isTL && !isSuperAdmin) {
        // Enforce TL can only reassign students already explicitly assigned to them
        query.$or = [{ assignedTo: req.staff._id }, { assignedBy: req.staff._id }];
    }

    const result = await Student.updateMany(
      query,
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
    // Log activity for Super Admin
    logActivity({
      type: 'status_updated',
      category: 'counselor',
      user: req.staff?.fullName || 'Staff',
      actorId: req.staff?._id,
      actorName: req.staff?.fullName,
      actorEmail: req.staff?.email,
      actorRole: req.staff?.role,
      actorDepartment: req.staff?.department,
      action: `Updated counseling status to "${counselingStatus || 'updated'}"`,
      target: student?.fullName || 'Student',
      targetId: id,
      targetModel: 'Student',
      metadata: {
        newStatus: counselingStatus,
        notes: counselingNotes,
        studentEmail: student?.email
      }
    }).catch(err => console.error('Error logging status activity:', err));

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
    const isTL = isTLRole(req.staff) && !isSuperAdminOrAdmin(req.staff);
    const tlId = req.staff?._id;

    if (isTL) {
      const [
        totalStudents,
        assignedStudents,
        unassignedStudents,
        totalBDEs,
        statusCounts
      ] = await Promise.all([
        Student.countDocuments({ $or: [{ assignedTo: tlId }, { assignedBy: tlId }] }),
        Student.countDocuments({ assignedBy: tlId, assignedTo: { $nin: [tlId, null] } }),
        Student.countDocuments({ assignedTo: tlId }),
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
            $match: {
              $or: [{ assignedTo: tlId }, { assignedBy: tlId }]
            }
          },
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

      return res.status(200).json({
        success: true,
        data: {
          totalStudents,
          assignedStudents,
          unassignedStudents,
          totalBDEs,
          statusBreakdown: statusMap
        }
      });
    }

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
    let baseCounselorFilter = { assignedTo: counselorObjectId };
    if (loggedInStaff.role === 'tl' || loggedInStaff.systemRole === 'tl') {
        baseCounselorFilter = {
            $or: [
                { assignedTo: counselorObjectId },
                { assignedBy: counselorObjectId }
            ]
        };
    }
    const query = { ...baseCounselorFilter };

    if (college && college !== 'all') {
      query.college = { $regex: new RegExp(escapeRegex(college.trim()), 'i') };
    }

    if (course && course !== 'all' && course.trim()) {
      query.course = { $regex: new RegExp(escapeRegex(course.trim()), 'i') };
    }

    if (semester && semester !== 'all' && semester.trim()) {
      query.semester = { $regex: new RegExp(escapeRegex(semester.trim()), 'i') };
    }


        const sourceParam = req.query.source;
    if (sourceParam && sourceParam !== 'all') {
      const source = sourceParam;
      if (source === 'organic') query.source = 'organic';
      else if (source === 'import') query.source = 'import';
      else if (source === 'test') { 
        query.source = { $nin: ['organic', 'import'] }; 
        // student taken test usually means technology assigned or eventCode exists
      }
      else if (source === 'internship') { 
        query.source = { $nin: ['organic', 'import'] }; 
        query.technology = { $exists: true, $ne: '' }; 
      }
      else query.source = source;
    }
  
    if (counselingStatus && counselingStatus !== 'all') {
      query.counselingStatus = counselingStatus;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
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



    // Automatically attach test results from Result collection for drive / internship students if missing
    try {
      const studentEmails = students.map(s => s.email?.toLowerCase()).filter(Boolean);
      const studentIds = students.map(s => s._id);

      const results = await Result.find({
        $or: [
          { studentEmail: { $in: studentEmails } },
          { studentId: { $in: studentIds } }
        ]
      }).lean();

      const resultMap = new Map();
      results.forEach(r => {
        if (r.studentEmail) resultMap.set(r.studentEmail.toLowerCase(), r);
        if (r.studentId) resultMap.set(r.studentId.toString(), r);
      });

      students.forEach(s => {
        const r = resultMap.get(s.email?.toLowerCase()) || resultMap.get(s._id.toString());
        if (r) {
          if (s.testScore === undefined || s.testScore === null) s.testScore = r.score;
          if (s.testPercentage === undefined || s.testPercentage === null) s.testPercentage = r.percentage;
          if (!s.testStatus) s.testStatus = r.status;
          if (s.testTotalQuestions === undefined || s.testTotalQuestions === null) s.testTotalQuestions = r.totalQuestions;
          if (!s.testTrack && r.testTrack) s.testTrack = r.testTrack;
          s.resultDeclared = true;
        }
      });
    } catch (rErr) {
      console.warn('Error attaching test results to assigned students:', rErr.message);
    }

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
          follow_up: statusBreakdown.follow_up || 0,
          ringing: statusBreakdown.ringing || 0,
          registered: statusBreakdown.registered || 0,
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
    // Log activity for Super Admin
    logActivity({
      type: 'lead_added',
      category: 'leads',
      user: loggedInStaff.fullName || 'Staff',
      actorId: loggedInStaff._id,
      actorName: loggedInStaff.fullName,
      actorEmail: loggedInStaff.email,
      actorRole: loggedInStaff.role,
      actorDepartment: loggedInStaff.department,
      action: 'Added new student lead',
      target: newStudent.fullName,
      targetId: newStudent._id,
      targetModel: 'Student',
      metadata: {
        email: newStudent.email,
        phone: newStudent.phoneNumber,
        technology: newStudent.technology,
        college: newStudent.college,
        counselingStatus: newStudent.counselingStatus
      }
    }).catch(err => console.error('Error logging lead add activity:', err));
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
    // Log activity for Super Admin
    logActivity({
      type: 'registration_slip_generated',
      category: 'finance',
      user: counselorName || req.staff?.fullName || 'Counselor',
      actorId: counselorId || req.staff?._id,
      actorRole: req.staff?.role || 'counselor',
      actorDepartment: req.staff?.department || 'Counseling',
      action: `Generated registration slip (${registrationNo}) with paid amount ₹${paidAmount}`,
      target: studentName,
      targetId: studentId,
      targetModel: 'Student',
      metadata: {
        registrationNo,
        paidAmount,
        totalFee,
        technology
      }
    }).catch(err => console.error('Error logging slip activity:', err));

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


// 12. Generate 2-Hour Protected Assessment Link for Student
exports.generateTestLink = async (req, res) => {
  try {
    const { studentId, sendEmail = false } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Only Organic Leads and Excel Leads need a 2-hour assessment link (Non-organic internship leads already took the test)
    if (student.source !== 'organic' && student.source !== 'import') {
      return res.status(400).json({
        success: false,
        message: 'Assessment link can only be generated for Organic Leads and Excel Leads. Internship / Campus Drive leads have already completed their test.'
      });
    }

    // Generate 48-char secure crypto hex token
    const token = crypto.randomBytes(24).toString('hex');
    // 2-hour validity window
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    student.testToken = token;
    student.testTokenExpires = expiresAt;
    student.testTokenStatus = 'generated';
    student.testLinkGeneratedAt = new Date();
    await student.save();

    // Helper to get staff display name safely
    const getStaffDisplayName = (staffDoc) => {
      if (!staffDoc) return '';
      if (staffDoc.fullName && staffDoc.fullName.trim()) return staffDoc.fullName.trim();
      const combined = `${staffDoc.firstName || ''} ${staffDoc.lastName || ''}`.trim();
      return combined || '';
    };

    // Determine counselor details - the staff member who sent/generated the test link
    let counselorDetails = {
      fullName: getStaffDisplayName(req.staff) || 'Wipronix Career Counselor',
      email: req.staff?.email || '',
      phoneNumber: req.staff?.phoneNumber || '',
      designation: req.staff?.designation || (req.staff?.role === 'counselor' ? 'Academic & Career Counselor' : 'Career Counseling & Admissions')
    };

    // If an administrative user generated it and this student is assigned to a specific counselor, attribute to the assigned counselor
    if (['super_admin', 'admin'].includes(req.staff?.role) && student.assignedTo) {
      try {
        const assignedStaff = await Staff.findById(student.assignedTo).select('firstName lastName fullName email phoneNumber designation role');
        if (assignedStaff) {
          const assignedName = getStaffDisplayName(assignedStaff);
          if (assignedName) {
            counselorDetails = {
              fullName: assignedName,
              email: assignedStaff.email || counselorDetails.email,
              phoneNumber: assignedStaff.phoneNumber || counselorDetails.phoneNumber,
              designation: assignedStaff.designation || 'Academic & Career Counselor'
            };
          }
        }
      } catch (stErr) {}
    }

    // Log activity for Super Admin
    logActivity({
      type: 'test_link_generated',
      category: 'counselor',
      user: counselorDetails.fullName || req.staff?.fullName || 'Counselor',
      actorId: req.staff?._id,
      actorName: req.staff?.fullName || counselorDetails.fullName,
      actorEmail: req.staff?.email || counselorDetails.email,
      actorRole: req.staff?.role || 'counselor',
      actorDepartment: req.staff?.department || 'Counseling',
      action: `Generated 2-Hour Assessment Link (Counselor: ${counselorDetails.fullName})`,
      target: student.fullName,
      targetId: student._id,
      targetModel: 'Student',
      metadata: {
        technology: student.technology,
        college: student.college,
        expiresAt,
        sentEmail: sendEmail,
        studentEmail: student.email,
        counselorName: counselorDetails.fullName,
        counselorEmail: counselorDetails.email
      }
    }).catch(err => console.error('Error logging test link activity:', err));

    // Frontend URL
    let websiteUrl = process.env.NODE_ENV === 'development'
      ? (process.env.LOCAL_WEBSITE_URL || 'http://localhost:5173')
      : (process.env.FRONTEND_URL || process.env.WEBSITE_URL || 'https://www.wipronix.com');
    const cleanWebsiteUrl = websiteUrl.replace(/\/auth\/?$/, '').replace(/\/+$/, '');
    const testLink = `${cleanWebsiteUrl}/assessment/${token}`;

    let emailSent = false;
    if (sendEmail && student.email) {
      try {
        const mailRes = await emailService.sendAssignedAssessmentLinkEmail(student, testLink, counselorDetails);
        emailSent = Boolean(mailRes?.success);
      } catch (emErr) {
        console.warn('Error sending test link email:', emErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: emailSent
        ? `Test link generated and emailed to student from ${counselorDetails.fullName} (Valid for 2 Hours)!`
        : 'Test link generated successfully (Valid for 2 Hours)!',
      data: {
        token,
        testLink,
        expiresAt,
        emailSent,
        counselor: counselorDetails,
        student: {
          _id: student._id,
          fullName: student.fullName,
          email: student.email,
          phoneNumber: student.phoneNumber,
          technology: student.technology,
          course: student.course,
          college: student.college
        }
      }
    });
  } catch (error) {
    console.error('Error generating test link:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 13. Log Call & Follow-up Details
exports.logCallAndFollowUp = async (req, res) => {
  try {
    const { studentId, callOutcome, notes, nextFollowUpDate, counselingStatus } = req.body;
    const loggedInStaff = req.staff || {};

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const outcome = callOutcome || 'connected';
    const cleanNotes = notes || '';
    const followUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;

    const newLog = {
      calledAt: new Date(),
      calledBy: loggedInStaff._id || null,
      calledByName: loggedInStaff.fullName || `${loggedInStaff.firstName || ''} ${loggedInStaff.lastName || ''}`.trim() || 'Counselor',
      callOutcome: outcome,
      notes: cleanNotes,
      nextFollowUpDate: followUpDate
    };

    if (!Array.isArray(student.callLogs)) {
      student.callLogs = [];
    }
    student.callLogs.unshift(newLog);

    student.lastContactedAt = new Date();
    if (followUpDate) {
      student.nextFollowUpDate = followUpDate;
    }
    if (cleanNotes) {
      student.counselingNotes = cleanNotes;
    }

    if (counselingStatus) {
      student.counselingStatus = counselingStatus;
    } else {
      if (outcome.includes('interested')) {
        student.counselingStatus = 'interested';
      } else if (outcome.includes('follow_up') || followUpDate) {
        student.counselingStatus = 'follow_up';
      } else if (outcome.includes('not_interested')) {
        student.counselingStatus = 'not_interested';
      } else if (outcome.includes('registered') || outcome.includes('enrolled')) {
        student.counselingStatus = 'enrolled';
      } else if (outcome.includes('ringing') || outcome.includes('no_answer')) {
        student.counselingStatus = 'ringing';
      } else {
        student.counselingStatus = 'contacted';
      }
    }

    await student.save();

    // Log activity for Super Admin
    logActivity({
      type: 'call_logged',
      category: 'counselor',
      user: newLog.calledByName || 'Counselor',
      actorId: newLog.calledBy,
      actorName: newLog.calledByName,
      actorRole: loggedInStaff?.role || 'counselor',
      actorDepartment: loggedInStaff?.department || 'Counseling',
      action: `Called student: ${outcome}`,
      target: student.fullName,
      targetId: student._id,
      targetModel: 'Student',
      metadata: {
        callOutcome: outcome,
        counselingStatus: student.counselingStatus,
        nextFollowUpDate: followUpDate,
        notes: cleanNotes,
        studentPhone: student.phoneNumber,
        studentEmail: student.email,
        college: student.college
      }
    }).catch(err => console.error('Error logging call activity:', err));

    return res.status(200).json({
      success: true,
      message: 'Calling details & follow-up saved successfully!',
      data: student
    });
  } catch (error) {
    console.error('Error logging call and follow-up:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 14. Get Call History & Follow-ups Timeline
exports.getCallHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findById(studentId)
      .select('fullName email phoneNumber college callLogs nextFollowUpDate counselingStatus counselingNotes assignedAt')
      .populate('callLogs.calledBy', 'firstName lastName fullName email');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        student,
        callLogs: student.callLogs || []
      }
    });
  } catch (error) {
    console.error('Error fetching call history:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

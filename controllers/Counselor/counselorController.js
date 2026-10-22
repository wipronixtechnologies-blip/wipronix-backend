const mongoose = require('mongoose');
const Student = require('../../models/Student.model');
const Staff = require('../../models/Staff.model');
const College = require('../../models/College.model');
const EventTest = require('../../models/EventTest.model');
const RegistrationSlip = require('../../models/RegistrationSlip.model');
const Result = require('../../models/Result.model');
const Task = require('../../models/Task.model');
const DailyWorkReport = require('../../models/DailyWorkReport.model');
const Notification = require('../../models/Notification.model');
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

    // Find all Counselors / BDEs / TLs strictly in the MARKETING department only (excluding purely administrative roles)
    const bdes = await Staff.find({
      department: { $regex: /marketing/i },
      role: { $nin: ['super_admin', 'admin'] },
      systemRole: { $nin: ['super_admin', 'admin'] },
      isActive: true
    }).select('firstName lastName fullName email phoneNumber department designation role systemRole profileImage createdAt');

    // Aggregate assignment counts and colleges per BDE
    const bdeIds = bdes.map(b => b._id);
    const matchFilter = {
      assignedTo: { $in: bdeIds }
    };

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

// 1.5 Get All Distinct College Names in the System
exports.getAllCollegeNames = async (req, res) => {
  try {
    const isTL = isTLRole(req.staff) && !isSuperAdminOrAdmin(req.staff);
    const tlId = req.staff?._id;

    let studentCollegesQuery = {};
    if (isTL) {
      studentCollegesQuery = { $or: [{ assignedTo: tlId }, { assignedBy: tlId }] };
    }

    const [studentColleges, eventColleges, collegeDocs] = await Promise.all([
      Student.distinct('college', studentCollegesQuery),
      EventTest.distinct('collegeName'),
      College.distinct('name')
    ]);

    const collegeSet = new Set();
    const addClean = (name) => {
      if (name && typeof name === 'string' && name.trim()) {
        collegeSet.add(name.trim());
      }
    };

    (studentColleges || []).forEach(addClean);
    (eventColleges || []).forEach(addClean);
    (collegeDocs || []).forEach(addClean);

    // Sort case-insensitively
    const sortedColleges = Array.from(collegeSet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    return res.status(200).json({
      success: true,
      data: sortedColleges
    });
  } catch (error) {
    console.error('Error fetching college names:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get College-wise Student Stats from EventTests and Student collections
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

      // If TL has assigned students in a college not listed in EventTest, add an entry for it
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
          matchedCollegeNames.push(cName.trim().toLowerCase());
        }
      });
    } else {
      // For Admin / Super Admin: also include all distinct colleges from students that don't have an EventTest
      const studentColleges = await Student.distinct('college');
      const matchedCollegeNames = targetEvents.map(e => (e.collegeName || '').trim().toLowerCase());
      studentColleges.forEach(cName => {
        if (cName && cName.trim() && !matchedCollegeNames.includes(cName.trim().toLowerCase())) {
          targetEvents.push({
            _id: new mongoose.Types.ObjectId(),
            eventCode: 'CAMPUS-POOL',
            testTitle: `${cName.trim()} Student Pool`,
            technology: 'Campus Leads',
            eventType: 'Direct / Campus Leads',
            conductedBy: 'Direct Entry',
            collegeName: cName.trim()
          });
          matchedCollegeNames.push(cName.trim().toLowerCase());
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

    // Verify BDE exists and belongs to the Marketing department
    const bde = await Staff.findById(bdeId);
    if (!bde) {
      return res.status(404).json({ success: false, message: 'Selected BDE employee not found' });
    }
    const bdeDept = (bde.department || '').toLowerCase();
    if (!bdeDept.includes('marketing')) {
      return res.status(400).json({ success: false, message: 'Students can only be assigned to staff members in the Marketing department.' });
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
    const newBdeDept = (newBde.department || '').toLowerCase();
    if (!newBdeDept.includes('marketing')) {
      return res.status(400).json({ success: false, message: 'Students can only be reassigned to staff members in the Marketing department.' });
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
    // If admin/HR/TL and counselorId is specified, allow switching; otherwise use logged in staff ID
    let targetStaffId = loggedInStaff._id;
    const isPrivileged = ['super_admin', 'admin', 'hr', 'hr_manager', 'tl'].includes(loggedInStaff.role) ||
      ['super_admin', 'admin', 'hr', 'hr_manager', 'tl'].includes(loggedInStaff.systemRole);

    if (req.query.counselorId && req.query.counselorId !== 'all' && isPrivileged) {
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
      leadStage,
      leadSubStage,
      course,
      semester,
      inactivity,
      search,
      page = 1,
      limit = 25,
      sortBy = 'assignedAt',
      sortOrder = 'desc'
    } = req.query;

    const isTL = isTLRole(loggedInStaff) && !isSuperAdminOrAdmin(loggedInStaff);

    // Base match filter for this counselor's assignments
    let baseCounselorFilter;
    if (req.query.counselorId && req.query.counselorId !== 'all') {
      // Viewing as a specific counselor (for TL, Admin, and Super Admin)
      baseCounselorFilter = { assignedTo: counselorObjectId };
    } else if (req.query.counselorId === 'all') {
      // Viewing all team leads
      if (isTL) {
        baseCounselorFilter = {
          $or: [
            { assignedTo: loggedInStaff._id },
            { assignedBy: loggedInStaff._id }
          ]
        };
      } else {
        baseCounselorFilter = { assignedTo: { $ne: null } };
      }
    } else {
      // Default: logged in staff viewing their own assigned students
      baseCounselorFilter = { assignedTo: loggedInStaff._id };
    }
    const andConditions = [baseCounselorFilter];

    if (college && college !== 'all') {
      andConditions.push({ college: { $regex: new RegExp(escapeRegex(college.trim()), 'i') } });
    }

    if (course && course !== 'all' && course.trim()) {
      andConditions.push({ course: { $regex: new RegExp(escapeRegex(course.trim()), 'i') } });
    }

    if (semester && semester !== 'all' && semester.trim()) {
      andConditions.push({ semester: { $regex: new RegExp(escapeRegex(semester.trim()), 'i') } });
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

    if (leadStage && leadStage !== 'all') {
      if (leadStage === 'Admission done') {
        andConditions.push({
          $or: [
            { leadStage: 'Admission done' },
            { counselingStatus: { $in: ['enrolled', 'registered'] } }
          ]
        });
      } else if (leadStage === 'Not interested') {
        andConditions.push({
          $or: [
            { leadStage: 'Not interested' },
            { counselingStatus: { $in: ['not_interested', 'rejected'] } }
          ]
        });
      } else if (leadStage === 'Not responding') {
        andConditions.push({
          $or: [
            { leadStage: 'Not responding' },
            { counselingStatus: 'ringing' }
          ]
        });
      } else if (leadStage === 'Call back later') {
        andConditions.push({
          $or: [
            { leadStage: 'Call back later' },
            { counselingStatus: 'contacted' }
          ]
        });
      } else if (leadStage === 'Follow up') {
        andConditions.push({
          $or: [
            { leadStage: 'Follow up' },
            { counselingStatus: { $in: ['follow_up', 'assigned', 'interested'] } },
            { leadStage: { $exists: false }, counselingStatus: { $exists: false } }
          ]
        });
      } else {
        andConditions.push({ leadStage });
      }
    }

    if (leadSubStage && leadSubStage !== 'all') {
      if (leadSubStage === 'shortlisted') {
        try {
          const shortlistedResults = await Result.find({
            $or: [{ isShortlisted: true }, { isSelected: true }]
          }).select('studentEmail studentId').lean();
          const emailSet = new Set();
          shortlistedResults.forEach(r => {
            if (r.studentEmail) {
              emailSet.add(r.studentEmail);
              emailSet.add(r.studentEmail.toLowerCase());
            }
          });
          const slEmails = Array.from(emailSet);
          const slIds = shortlistedResults.map(r => r.studentId).filter(Boolean);
          const orList = [
            { isShortlisted: true },
            { isSelected: true }
          ];
          if (slEmails.length > 0) {
            orList.push({ email: { $in: slEmails } });
            const emailRegexPatterns = slEmails.map(e => `^${escapeRegex(e)}$`).join('|');
            if (emailRegexPatterns.length < 4000) {
              orList.push({ email: { $regex: new RegExp(emailRegexPatterns, 'i') } });
            }
          }
          if (slIds.length > 0) {
            orList.push({ _id: { $in: slIds } });
          }
          andConditions.push({ $or: orList });
        } catch (slErr) {
          andConditions.push({
            $or: [{ isShortlisted: true }, { isSelected: true }]
          });
        }
      } else if (leadSubStage === 'machine_selected') {
        try {
          const selectedResults = await Result.find({ isSelected: true }).select('studentEmail studentId').lean();
          const selEmails = selectedResults.map(r => r.studentEmail?.toLowerCase()).filter(Boolean);
          const selIds = selectedResults.map(r => r.studentId).filter(Boolean);
          andConditions.push({
            $or: [
              { isSelected: true },
              { email: { $in: selEmails } },
              { _id: { $in: selIds } }
            ]
          });
        } catch (selErr) {
          andConditions.push({ isSelected: true });
        }
      } else if (leadSubStage === 'tests_completed') {
        andConditions.push({
          $or: [
            { resultDeclared: true },
            { testTokenStatus: 'completed' },
            { testCompletedAt: { $ne: null } }
          ]
        });
      } else if (leadSubStage === 'untouched') {
        andConditions.push({
          $or: [
            { lastContactedAt: null },
            { lastTouchedAt: null }
          ]
        });
      } else {
        andConditions.push({
          leadSubStage: { $regex: new RegExp(`^${escapeRegex(leadSubStage.trim())}$`, 'i') }
        });
      }
    }

    if (counselingStatus && counselingStatus !== 'all') {
      if (counselingStatus === 'machine_selected') {
        try {
          const selectedResults = await Result.find({ isSelected: true }).select('studentEmail studentId').lean();
          const selectedEmails = selectedResults.map(r => r.studentEmail?.toLowerCase()).filter(Boolean);
          const selectedStudentIds = selectedResults.map(r => r.studentId).filter(Boolean);
          andConditions.push({
            $or: [
              { email: { $in: selectedEmails } },
              { _id: { $in: selectedStudentIds } }
            ]
          });
        } catch (selErr) {
          console.warn('Error querying selected results for filter:', selErr.message);
        }
      } else {
        andConditions.push({ counselingStatus });
      }
    }

    if (inactivity && inactivity !== 'all') {
      const now = new Date();
      if (inactivity === 'never_contacted') {
        andConditions.push({ lastContactedAt: null });
      } else if (inactivity === 'not_contacted_2_days') {
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        andConditions.push({
          $or: [
            { lastContactedAt: null },
            { lastContactedAt: { $lte: twoDaysAgo } }
          ]
        });
      } else if (inactivity === 'not_contacted_5_days') {
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        andConditions.push({
          $or: [
            { lastContactedAt: null },
            { lastContactedAt: { $lte: fiveDaysAgo } }
          ]
        });
      } else if (inactivity === 'not_contacted_7_days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        andConditions.push({
          $or: [
            { lastContactedAt: null },
            { lastContactedAt: { $lte: sevenDaysAgo } }
          ]
        });
      } else if (inactivity === 'contacted_active') {
        andConditions.push({ lastContactedAt: { $ne: null } });
      } else if (inactivity === 'machine_selected') {
        try {
          const selectedResults = await Result.find({ isSelected: true }).select('studentEmail studentId').lean();
          const selectedEmails = selectedResults.map(r => r.studentEmail?.toLowerCase()).filter(Boolean);
          const selectedStudentIds = selectedResults.map(r => r.studentId).filter(Boolean);
          andConditions.push({
            $or: [
              { email: { $in: selectedEmails } },
              { _id: { $in: selectedStudentIds } }
            ]
          });
        } catch (selErr) {
          console.warn('Error querying selected results for inactivity filter:', selErr.message);
        }
      } else if (inactivity === 'machine_shortlisted') {
        try {
          const shortlistedResults = await Result.find({ $or: [{ isShortlisted: true }, { isSelected: true }] }).select('studentEmail studentId').lean();
          const emailSet = new Set();
          shortlistedResults.forEach(r => {
            if (r.studentEmail) {
              emailSet.add(r.studentEmail);
              emailSet.add(r.studentEmail.toLowerCase());
            }
          });
          const shortlistedEmails = Array.from(emailSet);
          const shortlistedStudentIds = shortlistedResults.map(r => r.studentId).filter(Boolean);
          const orList = [
            { isShortlisted: true },
            { isSelected: true }
          ];
          if (shortlistedEmails.length > 0) {
            orList.push({ email: { $in: shortlistedEmails } });
            const emailRegexPatterns = shortlistedEmails.map(e => `^${escapeRegex(e)}$`).join('|');
            if (emailRegexPatterns.length < 4000) {
              orList.push({ email: { $regex: new RegExp(emailRegexPatterns, 'i') } });
            }
          }
          if (shortlistedStudentIds.length > 0) {
            orList.push({ _id: { $in: shortlistedStudentIds } });
          }
          andConditions.push({ $or: orList });
        } catch (selErr) {
          console.warn('Error querying shortlisted results:', selErr.message);
        }
      } else if (inactivity === 'machine_completed') {
        try {
          const completedResults = await Result.find({ machineRoundStatus: 'COMPLETED' }).select('studentEmail studentId').lean();
          const completedEmails = completedResults.map(r => r.studentEmail?.toLowerCase()).filter(Boolean);
          const completedStudentIds = completedResults.map(r => r.studentId).filter(Boolean);
          andConditions.push({
            $or: [
              { email: { $in: completedEmails } },
              { _id: { $in: completedStudentIds } }
            ]
          });
        } catch (selErr) {
          console.warn('Error querying completed machine round results:', selErr.message);
        }
      }
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      andConditions.push({
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
          { course: searchRegex },
          { semester: searchRegex },
          { technology: searchRegex },
          { city: searchRegex },
          { college: searchRegex }
        ]
      });
    }

    const query = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

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
          s.isSelected = Boolean(r.isSelected);
          s.isShortlisted = Boolean(r.isShortlisted);
          s.machineRoundStatus = r.machineRoundStatus || 'NOT_APPLICABLE';
          s.machineRoundScore = r.machineRoundScore;
          s.machineRoundPassedTestCases = r.machineRoundPassedTestCases;
          s.machineRoundTotalTestCases = r.machineRoundTotalTestCases;
          s.machineRoundSubmittedAt = r.machineRoundSubmittedAt;
          s.machineRoundTechnology = r.machineRoundTechnology;
          s.offerLetterSent = Boolean(r.offerLetterSent);
          s.offerLetterSentDate = r.offerLetterSentDate;
          s.technicalRoundMarks = r.technicalRoundMarks;
          s.screeningRoundMarks = r.screeningRoundMarks;
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

    // Count machine selected students in this counselor's pool
    let machineSelectedCount = 0;
    try {
      const assignedStudentsList = await Student.find(baseCounselorFilter).select('email _id').lean();
      const assignedEmails = assignedStudentsList.map(s => s.email?.toLowerCase()).filter(Boolean);
      const assignedIds = assignedStudentsList.map(s => s._id);
      machineSelectedCount = await Result.countDocuments({
        isSelected: true,
        $or: [
          { studentEmail: { $in: assignedEmails } },
          { studentId: { $in: assignedIds } }
        ]
      });
    } catch (cntErr) {
      console.warn('Error counting machine selected students:', cntErr.message);
    }

    // Aggregate 5 Main Lead Stages across all leads for this counselor
    const allAssignedStudents = await Student.find(baseCounselorFilter).select('leadStage leadSubStage counselingStatus').lean();
    const stageCounts = {
      all: totalAssignedCount,
      'Not responding': 0,
      'Follow up': 0,
      'Call back later': 0,
      'Not interested': 0,
      'Admission done': 0
    };
    const subStageCounts = {};

    allAssignedStudents.forEach(s => {
      let stage = s.leadStage;
      if (!stage) {
        const st = s.counselingStatus || 'assigned';
        if (st === 'enrolled' || st === 'registered') stage = 'Admission done';
        else if (st === 'not_interested' || st === 'rejected') stage = 'Not interested';
        else if (st === 'ringing') stage = 'Not responding';
        else if (st === 'contacted') stage = 'Call back later';
        else stage = 'Follow up';
      }
      if (stageCounts[stage] !== undefined) {
        stageCounts[stage]++;
      } else {
        stageCounts['Follow up']++;
      }
      if (s.leadSubStage) {
        subStageCounts[s.leadSubStage] = (subStageCounts[s.leadSubStage] || 0) + 1;
      }
    });

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
          machineSelected: machineSelectedCount,
          conversionRate,
          totalColleges: distinctColleges.filter(Boolean).length,
          stageCounts,
          subStageCounts
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
    const canAssignToOthers = isSuperAdminOrAdmin(loggedInStaff) || isTLRole(loggedInStaff);

    if (assignedTo && canAssignToOthers) {
      targetCounselorId = assignedTo;
    }

    const cleanCollege = college && college.trim() ? college.trim() : 'Direct Lead';

    // If new college provided, ensure it exists in College model
    if (cleanCollege && cleanCollege !== 'Direct Lead') {
      try {
        const colExists = await College.findOne({ name: { $regex: new RegExp(`^${escapeRegex(cleanCollege)}$`, 'i') } });
        if (!colExists) {
          await College.create({
            name: cleanCollege,
            status: 'active',
            createdBy: loggedInStaff._id
          });
        }
      } catch (colErr) {
        console.warn('Could not auto-register College:', colErr.message);
      }
    }

    // Check if duplicate student with email exists
    const query = { email: cleanEmail };
    if (cleanTech) {
      query.technology = cleanTech;
    }

    let existingStudent = await Student.findOne(query);

    if (existingStudent) {
      const isSelfAssigned = existingStudent.assignedTo && existingStudent.assignedTo.toString() === loggedInStaff._id.toString();
      const isUnassigned = !existingStudent.assignedTo;

      if (canAssignToOthers || isSelfAssigned || isUnassigned) {
        existingStudent.fullName = fullName.trim() || existingStudent.fullName;
        if (phoneNumber) existingStudent.phoneNumber = phoneNumber.trim();
        existingStudent.college = cleanCollege;
        if (course) existingStudent.course = course.trim();
        if (semester) existingStudent.semester = semester.trim();
        if (city) existingStudent.city = city.trim();
        if (passingYear) existingStudent.passingYear = passingYear.toString().trim();
        if (cleanTech) existingStudent.technology = cleanTech;
        existingStudent.assignedTo = targetCounselorId;
        existingStudent.assignedBy = loggedInStaff._id;
        existingStudent.createdBy = existingStudent.createdBy || loggedInStaff._id;
        existingStudent.assignedAt = new Date();
        existingStudent.counselingStatus = counselingStatus || existingStudent.counselingStatus || 'assigned';
        if (counselingNotes) existingStudent.counselingNotes = counselingNotes.trim();

        await existingStudent.save();
        await existingStudent.populate('assignedTo', 'firstName lastName fullName email designation department role');
        await existingStudent.populate('assignedBy', 'firstName lastName fullName email designation department role');
        await existingStudent.populate('createdBy', 'firstName lastName fullName email designation department role');

        return res.status(200).json({
          success: true,
          message: 'Student lead already in system; details updated and assigned successfully!',
          data: existingStudent
        });
      } else {
        const currentAssignee = await Staff.findById(existingStudent.assignedTo).select('fullName email');
        return res.status(400).json({
          success: false,
          message: `A student with this email (${cleanEmail}) is already assigned to counselor ${currentAssignee?.fullName || 'another counselor'}.`
        });
      }
    }

    // Create new Student lead
    const newStudent = new Student({
      fullName: fullName.trim(),
      email: cleanEmail,
      phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
      college: cleanCollege,
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
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .populate('callLogs.calledBy', 'firstName lastName fullName email designation department role profileImage')
      .populate('assignedTo', 'firstName lastName fullName email designation department role profileImage phoneNumber')
      .populate('assignedBy', 'firstName lastName fullName email designation department role profileImage')
      .populate('createdBy', 'firstName lastName fullName email designation department role profileImage')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Attach test results from Result collection if missing or available
    try {
      const result = await Result.findOne({
        $or: [
          { studentEmail: student.email?.toLowerCase() },
          { studentId: student._id }
        ]
      }).sort({ createdAt: -1 }).lean();

      if (result) {
        if (student.testScore === undefined || student.testScore === null) student.testScore = result.score;
        if (student.testPercentage === undefined || student.testPercentage === null) student.testPercentage = result.percentage;
        if (!student.testStatus) student.testStatus = result.status;
        if (student.testTotalQuestions === undefined || student.testTotalQuestions === null) student.testTotalQuestions = result.totalQuestions;
        if (!student.testTrack && result.testTrack) student.testTrack = result.testTrack;
        if (student.testCorrect === undefined || student.testCorrect === null) student.testCorrect = result.score;
        student.resultDeclared = true;
        student.isSelected = Boolean(result.isSelected);
        student.isShortlisted = Boolean(result.isShortlisted);
        student.machineRoundStatus = result.machineRoundStatus || 'NOT_APPLICABLE';
        student.machineRoundScore = result.machineRoundScore;
        student.machineRoundPassedTestCases = result.machineRoundPassedTestCases;
        student.machineRoundTotalTestCases = result.machineRoundTotalTestCases;
        student.machineRoundSubmittedAt = result.machineRoundSubmittedAt;
        student.machineRoundTechnology = result.machineRoundTechnology;
        student.offerLetterSent = Boolean(result.offerLetterSent);
        student.offerLetterSentDate = result.offerLetterSentDate;
        student.technicalRoundMarks = result.technicalRoundMarks;
        student.screeningRoundMarks = result.screeningRoundMarks;
      }
    } catch (rErr) {
      console.warn('Error attaching result in getCallHistory:', rErr.message);
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

// 15. Update Full Student Details (Edit info, add new/alternate number, update stage, demo, admission)
exports.updateStudentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInStaff = req.staff || {};

    const {
      fullName,
      email,
      phoneNumber,
      alternatePhoneNumber,
      college,
      course,
      semester,
      technology,
      city,
      passingYear,
      counselingStatus,
      counselingNotes,
      leadStage,
      leadSubStage,
      demoTechnology,
      demoTiming,
      admissionTechnology,
      admissionDate,
      admissionFee
    } = req.body;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    if (fullName) student.fullName = fullName.trim();
    if (email) student.email = email.trim().toLowerCase();
    if (phoneNumber !== undefined) student.phoneNumber = phoneNumber.trim();
    if (alternatePhoneNumber !== undefined) student.alternatePhoneNumber = alternatePhoneNumber.trim();
    if (college) student.college = college.trim();
    if (course) student.course = course.trim();
    if (semester !== undefined) student.semester = semester;
    if (technology !== undefined) student.technology = technology;
    if (city !== undefined) student.city = city;
    if (passingYear !== undefined) student.passingYear = passingYear;
    if (counselingNotes !== undefined) student.counselingNotes = counselingNotes;

    // Stage updates
    let stageChanged = false;
    if (leadStage) {
      student.leadStage = leadStage;
      stageChanged = true;
    }
    if (leadSubStage !== undefined) {
      student.leadSubStage = leadSubStage;
      stageChanged = true;
    }

    // Map parent stage to counselingStatus
    if (leadStage) {
      if (leadStage === 'Admission done') {
        student.counselingStatus = 'enrolled';
      } else if (leadStage === 'Not interested') {
        student.counselingStatus = 'not_interested';
      } else if (leadStage === 'Follow up') {
        student.counselingStatus = 'follow_up';
      } else if (leadStage === 'Call back later') {
        student.counselingStatus = 'contacted';
      } else if (leadStage === 'Not responding') {
        student.counselingStatus = 'ringing';
      }
    } else if (counselingStatus) {
      student.counselingStatus = counselingStatus;
    }

    // Demo Session Details
    if (demoTechnology) student.demoTechnology = demoTechnology;
    if (demoTiming) student.demoTiming = new Date(demoTiming);

    // Admission Details
    if (admissionTechnology) {
      student.admissionTechnology = admissionTechnology;
      student.technology = admissionTechnology; // Set student track
    }
    if (admissionDate) student.admissionDate = new Date(admissionDate);
    if (admissionFee !== undefined) student.admissionFee = admissionFee;

    // Inactivity tracking: touch the student
    student.lastTouchedAt = new Date();
    student.lastContactedAt = new Date();
    student.lastTouchedBy = loggedInStaff._id || null;
    student.lastTouchedByName = loggedInStaff.fullName || `${loggedInStaff.firstName || ''} ${loggedInStaff.lastName || ''}`.trim() || 'Staff';

    // Add entry to callLogs timeline if stage changed or notes provided
    if (stageChanged || counselingNotes) {
      const stageLogText = leadStage ? `${leadStage}${leadSubStage ? ` - ${leadSubStage}` : ''}` : 'Details Updated';
      if (!Array.isArray(student.callLogs)) student.callLogs = [];
      student.callLogs.unshift({
        calledAt: new Date(),
        calledBy: loggedInStaff._id || null,
        calledByName: student.lastTouchedByName,
        callOutcome: stageLogText,
        notes: counselingNotes || (demoTiming ? `Demo scheduled: ${demoTechnology} on ${new Date(demoTiming).toLocaleString()}` : (admissionTechnology ? `Enrolled in ${admissionTechnology}` : 'Student details updated')),
        nextFollowUpDate: student.nextFollowUpDate || null
      });
    }

    await student.save();
    await student.populate('assignedTo', 'firstName lastName fullName email designation department role profileImage phoneNumber');

    // Log activity
    logActivity({
      type: 'student_updated',
      category: 'counselor',
      user: student.lastTouchedByName,
      actorId: loggedInStaff._id,
      actorName: student.lastTouchedByName,
      actorRole: loggedInStaff.role || 'counselor',
      actorDepartment: loggedInStaff.department || 'Counseling',
      action: `Updated student details (${student.fullName}): ${leadStage || 'Updated'}`,
      target: student.fullName,
      targetId: student._id,
      targetModel: 'Student',
      metadata: {
        studentEmail: student.email,
        phone: student.phoneNumber,
        alternatePhone: student.alternatePhoneNumber,
        leadStage: student.leadStage,
        leadSubStage: student.leadSubStage,
        demoTechnology: student.demoTechnology,
        admissionTechnology: student.admissionTechnology
      }
    }).catch(() => null);

    return res.status(200).json({
      success: true,
      message: 'Student details updated successfully!',
      data: student
    });
  } catch (error) {
    console.error('Error in updateStudentDetails:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 16. Get TL Counselor Oversight & Untouched Leads Analytics (Marketing Team BDEs only)
exports.getTLTeamPerformance = async (req, res) => {
  try {
    const isTL = isTLRole(req.staff) && !isSuperAdminOrAdmin(req.staff);
    const tlId = req.staff?._id;

    // Strictly filter staff belonging to the MARKETING department only (excluding super_admin / admin)
    const bdeQuery = {
      department: { $regex: /marketing/i },
      role: { $nin: ['super_admin', 'admin'] },
      systemRole: { $nin: ['super_admin', 'admin'] },
      isActive: true
    };

    const counselors = await Staff.find(bdeQuery)
      .select('firstName lastName fullName email phoneNumber designation department role profileImage')
      .lean();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);
    const endOf7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalAssignedPool = 0;
    let totalContactedToday = 0;
    let totalUntouchedToday = 0;
    let totalUntouched1Day = 0;
    let totalUntouched2Days = 0;
    let totalUntouched3Days = 0;
    let totalUntouched5Days = 0;
    let totalUntouched7Days = 0;
    let totalFollowUpsOverdue = 0;
    let totalFollowUpsToday = 0;
    let totalFollowUpsTomorrow = 0;
    let totalFollowUpsThisWeek = 0;
    let totalAdmissions = 0;
    let totalCallsToday = 0;
    let totalTasksCompleted = 0;

    const teamReports = await Promise.all(
      counselors.map(async (c) => {
        const counselorFilter = { assignedTo: c._id };

        const [
          totalAssigned,
          touchedToday,
          untouchedToday,
          untouched1Day,
          untouched2Days,
          untouched3Days,
          untouched5Days,
          untouched7Days,
          admissionsDone,
          demosScheduled,
          followUpsOverdue,
          followUpsToday,
          followUpsTomorrow,
          followUpsThisWeek,
          interestedCount,
          tasksTotal,
          tasksCompleted,
          tasksPending,
          recentTasks,
          dailyReportToday,
          recentCallLogs,
          upcomingFollowUps
        ] = await Promise.all([
          Student.countDocuments(counselorFilter),
          Student.countDocuments({ ...counselorFilter, lastContactedAt: { $gte: startOfToday } }),
          Student.countDocuments({
            ...counselorFilter,
            $or: [
              { lastContactedAt: null },
              { lastContactedAt: { $lt: startOfToday } }
            ]
          }),
          Student.countDocuments({
            ...counselorFilter,
            $or: [
              { lastContactedAt: null },
              { lastContactedAt: { $lte: oneDayAgo } }
            ]
          }),
          Student.countDocuments({
            ...counselorFilter,
            $or: [
              { lastContactedAt: null },
              { lastContactedAt: { $lte: twoDaysAgo } }
            ]
          }),
          Student.countDocuments({
            ...counselorFilter,
            $or: [
              { lastContactedAt: null },
              { lastContactedAt: { $lte: threeDaysAgo } }
            ]
          }),
          Student.countDocuments({
            ...counselorFilter,
            $or: [
              { lastContactedAt: null },
              { lastContactedAt: { $lte: fiveDaysAgo } }
            ]
          }),
          Student.countDocuments({
            ...counselorFilter,
            $or: [
              { lastContactedAt: null },
              { lastContactedAt: { $lte: sevenDaysAgo } }
            ]
          }),
          Student.countDocuments({
            ...counselorFilter,
            $or: [
              { leadStage: 'Admission done' },
              { counselingStatus: { $in: ['enrolled', 'registered'] } }
            ]
          }),
          Student.countDocuments({
            ...counselorFilter,
            $or: [
              { leadSubStage: 'need demo session' },
              { demoTechnology: { $exists: true, $ne: '' } }
            ]
          }),
          Student.countDocuments({
            ...counselorFilter,
            nextFollowUpDate: { $lt: startOfToday, $ne: null }
          }),
          Student.countDocuments({
            ...counselorFilter,
            nextFollowUpDate: { $gte: startOfToday, $lte: endOfToday }
          }),
          Student.countDocuments({
            ...counselorFilter,
            nextFollowUpDate: { $gt: endOfToday, $lte: endOfTomorrow }
          }),
          Student.countDocuments({
            ...counselorFilter,
            nextFollowUpDate: { $lte: endOf7Days, $ne: null }
          }),
          Student.countDocuments({
            ...counselorFilter,
            $or: [
              { counselingStatus: 'interested' },
              { leadStage: 'Interested' }
            ]
          }),
          Task.countDocuments({ assignedTo: c._id }).catch(() => 0),
          Task.countDocuments({ assignedTo: c._id, status: 'completed' }).catch(() => 0),
          Task.countDocuments({ assignedTo: c._id, status: { $in: ['pending', 'in_progress'] } }).catch(() => 0),
          Task.find({ assignedTo: c._id }).sort({ createdAt: -1 }).limit(5).lean().catch(() => []),
          DailyWorkReport.findOne({ staff: c._id, date: todayStr }).lean().catch(() => null),
          // Fetch student call logs by this counselor
          Student.aggregate([
            { $match: { 'callLogs.calledBy': c._id } },
            { $unwind: '$callLogs' },
            { $match: { 'callLogs.calledBy': c._id } },
            { $sort: { 'callLogs.calledAt': -1 } },
            { $limit: 5 },
            {
              $project: {
                studentName: '$fullName',
                studentEmail: '$email',
                calledAt: '$callLogs.calledAt',
                callOutcome: '$callLogs.callOutcome',
                notes: '$callLogs.notes'
              }
            }
          ]).catch(() => []),
          // Top 5 upcoming follow-ups
          Student.find({
            ...counselorFilter,
            nextFollowUpDate: { $ne: null }
          })
            .sort({ nextFollowUpDate: 1 })
            .limit(5)
            .select('fullName email phoneNumber counselingStatus leadStage nextFollowUpDate counselingNotes')
            .lean()
            .catch(() => [])
        ]);

        const callsTodayCount = await Student.aggregate([
          { $match: { 'callLogs.calledBy': c._id, 'callLogs.calledAt': { $gte: startOfToday } } },
          { $unwind: '$callLogs' },
          { $match: { 'callLogs.calledBy': c._id, 'callLogs.calledAt': { $gte: startOfToday } } },
          { $count: 'count' }
        ]).then(res => res[0]?.count || 0).catch(() => 0);

        totalAssignedPool += totalAssigned;
        totalContactedToday += touchedToday;
        totalUntouchedToday += untouchedToday;
        totalUntouched1Day += untouched1Day;
        totalUntouched2Days += untouched2Days;
        totalUntouched3Days += untouched3Days;
        totalUntouched5Days += untouched5Days;
        totalUntouched7Days += untouched7Days;
        totalFollowUpsOverdue += followUpsOverdue;
        totalFollowUpsToday += followUpsToday;
        totalFollowUpsTomorrow += followUpsTomorrow;
        totalFollowUpsThisWeek += followUpsThisWeek;
        totalAdmissions += admissionsDone;
        totalCallsToday += callsTodayCount;
        totalTasksCompleted += tasksCompleted;

        const counselorData = {
          _id: c._id,
          fullName: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Counselor',
          email: c.email,
          phoneNumber: c.phoneNumber,
          designation: c.designation || 'BDE / Counselor',
          department: c.department || 'Marketing',
          role: c.role || 'bde',
          profileImage: c.profileImage
        };

        const metricsData = {
          totalAssigned,
          touchedToday,
          untouchedToday,
          untouched1Day,
          untouched2Days,
          untouched3Days,
          untouched5Days,
          untouched7Days,
          admissionsDone,
          demosScheduled,
          followUpsDue: followUpsToday + followUpsOverdue,
          followUpsOverdue,
          followUpsToday,
          followUpsTomorrow,
          followUpsThisWeek,
          interestedCount,
          callsTodayCount,
          tasksTotal,
          tasksCompleted,
          tasksPending,
          conversionRate: totalAssigned > 0 ? Math.round((admissionsDone / totalAssigned) * 100) : 0,
          recentTasks,
          dailyReportToday,
          recentCallLogs,
          upcomingFollowUps
        };

        return {
          counselor: counselorData,
          metrics: metricsData,
          // Flat attributes for backwards-compatibility
          counselorId: c._id,
          ...counselorData,
          ...metricsData
        };
      })
    );

    const summary = {
      totalAssignedPool,
      totalContactedToday,
      totalUntouchedToday,
      totalUntouched1Day,
      totalUntouched2Days,
      totalUntouched: totalUntouched3Days, // backwards-compatibility
      totalUntouched3Days,
      totalUntouched5Days,
      totalUntouched7Days,
      totalFollowUpsDue: totalFollowUpsToday + totalFollowUpsOverdue,
      totalFollowUpsOverdue,
      totalFollowUpsToday,
      totalFollowUpsTomorrow,
      totalFollowUpsThisWeek,
      totalAdmissions,
      totalCallsToday,
      totalTasksCompleted,
      totalActiveCounselors: counselors.length
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        counselors: teamReports
      }
    });
  } catch (error) {
    console.error('Error fetching TL team performance:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 17. Send BDE Catch-Up / Follow-Up Reminder Notification
exports.sendBDEReminderNotification = async (req, res) => {
  try {
    const { bdeId, customMessage, reminderType } = req.body;
    const sender = req.staff;
    if (!sender) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!bdeId) {
      return res.status(400).json({ success: false, message: 'BDE ID is required' });
    }

    const bde = await Staff.findById(bdeId);
    if (!bde) {
      return res.status(404).json({ success: false, message: 'BDE staff member not found' });
    }

    // Count pending follow-ups and untouched leads for this BDE
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [followUpsDue, untouchedToday, untouched3Days] = await Promise.all([
      Student.countDocuments({ assignedTo: bde._id, nextFollowUpDate: { $lte: endOfToday, $ne: null } }),
      Student.countDocuments({
        assignedTo: bde._id,
        $or: [{ lastContactedAt: null }, { lastContactedAt: { $lt: startOfToday } }]
      }),
      Student.countDocuments({
        assignedTo: bde._id,
        $or: [{ lastContactedAt: null }, { lastContactedAt: { $lte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } }]
      })
    ]);

    const senderName = sender.fullName || 'Team Lead';
    const notificationTitle = `Lead Follow-Up & Catch-Up Reminder from TL ${senderName}`;
    const notificationMessage = customMessage || 
      `Hi ${bde.fullName.split(' ')[0]}, you have ${followUpsDue} scheduled follow-up(s) and ${untouchedToday} pending lead(s) today (${untouched3Days} untouched 3+ days). Please connect with your assigned leads today!`;

    const notification = new Notification({
      recipient: bde._id,
      sender: sender._id,
      senderName: senderName,
      type: 'task',
      title: notificationTitle,
      message: notificationMessage,
      link: '/counselor/my-students',
      priority: 'urgent',
      metadata: {
        bdeId: bde._id,
        followUpsDue,
        untouchedToday,
        untouched3Days,
        sentBy: sender._id,
        reminderType: reminderType || 'follow_up'
      }
    });

    await notification.save();

    try {
      const { emitNotification } = require('../../src/services/socket');
      if (typeof emitNotification === 'function') {
        emitNotification(bde._id, notification);
      }
    } catch (sockErr) {
      // socket notification is optional if socket service is unavailable
    }

    return res.status(200).json({
      success: true,
      message: `Catch-up reminder notification sent to ${bde.fullName} successfully!`,
      data: notification
    });
  } catch (error) {
    console.error('Error sending BDE reminder:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

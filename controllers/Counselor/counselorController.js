const mongoose = require('mongoose');
const Student = require('../../models/Student.model');
const Staff = require('../../models/Staff.model');
const College = require('../../models/College.model');
const EventTest = require('../../models/EventTest.model');

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
          rejected: 0
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

// 3. Assign Students to BDE (Sequentially from unassigned pool)
exports.assignStudents = async (req, res) => {
  try {
    const { collegeName, bdeId, count } = req.body;

    if (!collegeName) {
      return res.status(400).json({ success: false, message: 'College name is required' });
    }

    if (!bdeId) {
      return res.status(400).json({ success: false, message: 'BDE selection is required' });
    }

    const assignCount = parseInt(count, 10);
    if (isNaN(assignCount) || assignCount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid number of students (> 0)' });
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

    const unassignedQuery = {
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
        {
          $or: [
            { assignedTo: null },
            { assignedTo: { $exists: false } }
          ]
        }
      ]
    };

    const totalUnassigned = await Student.countDocuments(unassignedQuery);

    if (totalUnassigned === 0) {
      return res.status(400).json({
        success: false,
        message: `No unassigned students available for ${collegeName}. All students from this college have already been assigned.`
      });
    }

    const numberToAssign = Math.min(assignCount, totalUnassigned);

    // Fetch the specific student IDs to assign
    const studentsToAssign = await Student.find(unassignedQuery)
      .select('_id fullName email')
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

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${numberToAssign} student(s) from ${collegeName} to ${bde.fullName}. ${remainingUnassigned} unassigned student(s) remain in the pool.`,
      data: {
        assignedCount: numberToAssign,
        requestedCount: assignCount,
        remainingUnassigned,
        bdeName: bde.fullName,
        bdeEmail: bde.email,
        collegeName,
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
      search,
      assignmentState, // 'assigned' | 'unassigned' | 'all'
      page = 1,
      limit = 25
    } = req.query;

    const query = {};

    if (college) {
      query.college = { $regex: new RegExp(college.trim(), 'i') };
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
        { technology: searchRegex },
        { city: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 25;
    const skip = (pageNum - 1) * limitNum;

    const [students, totalCount] = await Promise.all([
      Student.find(query)
        .select('-password -resetPasswordToken -resetPasswordExpires')
        .populate('assignedTo', 'firstName lastName fullName email designation department role')
        .populate('assignedBy', 'fullName email')
        .sort({ assignedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Student.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        students,
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

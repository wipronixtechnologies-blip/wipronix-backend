const fs = require('fs');
const mongoose = require('mongoose');
const Student = require('../../models/Student.model');
const Staff = require('../../models/Staff.model');
const College = require('../../models/College.model');
const EventTest = require('../../models/EventTest.model');
const RegistrationSlip = require('../../models/RegistrationSlip.model');
const RegistrationCourse = require('../../models/RegistrationCourse.model');

const DEFAULT_REGISTRATION_COURSES = [
  'AI / ML',
  'UI / UX & Product Design',
  'Full Stack Web Development (MERN)',
  'Python AI / ML & Data Science',
  'Data Analytics & Power BI',
  'Java Enterprise Software Engineering',
  'Cloud DevOps & AWS Infrastructure',
  'Mobile Application Development',
  'Cybersecurity & Ethical Hacking',
  'Software Testing & QA Automation'
];

const ensureRegistrationCourseExists = async (trackName, staffId = null) => {
  if (!trackName || typeof trackName !== 'string') return;
  const cleanName = trackName.trim();
  if (!cleanName || cleanName.length < 2) return;

  try {
    const existing = await RegistrationCourse.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') }
    });
    if (!existing) {
      await RegistrationCourse.create({
        name: cleanName,
        isActive: true,
        isCustom: true,
        createdBy: staffId || undefined
      });
    }
  } catch (err) {
    // Ignore duplicate key collision
  }
};
const Result = require('../../models/Result.model');
const Task = require('../../models/Task.model');
const DailyWorkReport = require('../../models/DailyWorkReport.model');
const Notification = require('../../models/Notification.model');
const crypto = require('crypto');
const emailService = require('../../src/services/emailService');
const { logActivity } = require('../Activity/activityController');
const { escapeRegex } = require('../../utils/regexUtils');
const { uploadBase64 } = require('../../src/services/cloudinaryService');

/**
 * Upload array of screenshots / base64 images to Cloudinary and return array of secure URLs
 */
async function uploadProofScreenshotsToCloudinary(items) {
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];
  const results = [];
  for (const item of list) {
    if (!item || typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    // Already hosted on Cloudinary or remote HTTPS CDN
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      results.push(trimmed);
      continue;
    }
    // Base64 data string (upload to Cloudinary)
    if (trimmed.startsWith('data:image') || trimmed.length > 500) {
      try {
        const uploadRes = await uploadBase64(trimmed, {
          folder: 'wipronix/payment-proofs',
          resource_type: 'image'
        });
        if (uploadRes?.secure_url) {
          results.push(uploadRes.secure_url);
        } else if (uploadRes?.url) {
          results.push(uploadRes.url);
        } else {
          results.push(trimmed);
        }
      } catch (upErr) {
        console.error('Failed to upload proof image to Cloudinary:', upErr.message);
        results.push(trimmed);
      }
    } else {
      results.push(trimmed);
    }
  }
  return results;
}

const isSuperAdminOrAdmin = (staff) => {
  if (!staff) return false;
  const roles = ['super_admin', 'superadmin', 'admin', 'director', 'hr', 'hr_manager'];
  return roles.includes(staff.role) || roles.includes(staff.systemRole);
};

const isTLRole = (staff) => {
  if (!staff) return false;
  return staff.role === 'tl' || staff.systemRole === 'tl';
};

const LEAD_PARENT_STAGES_LIST = [
  'Untouched leads',
  'Follow up',
  'Not responding',
  'Call back later',
  'Not interested',
  'Admission done'
];

const LEAD_SUB_STAGES_MAP = {
  'Untouched leads': [
    'never contacted',
    'assigned today',
    'untouched 1-2 days',
    'untouched 3+ days (stale)'
  ],
  'Follow up': [
    'need time to think',
    'want to consult parents',
    'want to visit',
    'need demo session',
    'waiting for exam result'
  ],
  'Not responding': [
    'not picked',
    'switch off',
    'ringing no response',
    'not reachable',
    'busy',
    'wrong number',
    'call declined'
  ],
  'Call back later': [
    'call back',
    'was busy somewhere outside'
  ],
  'Not interested': [
    'enrolled somewhere else',
    'looking for stipend based training',
    'parents denied',
    'relocation problem',
    'fees issues',
    'need only certificate'
  ],
  'Admission done': [
    'Full Stack Web Development (MERN)',
    'Python AI / ML & Data Science',
    'Data Analytics & Power BI',
    'Java Enterprise Software Engineering',
    'Cloud DevOps & AWS Infrastructure',
    'Mobile Application Development (Flutter/React Native)',
    'Other Technology Track'
  ]
};

const mapParentStageToStatus = (parentStage) => {
  if (parentStage === 'Admission done') return 'enrolled';
  if (parentStage === 'Not interested') return 'not_interested';
  if (parentStage === 'Not responding') return 'ringing';
  if (parentStage === 'Call back later') return 'contacted';
  if (parentStage === 'Follow up') return 'follow_up';
  if (parentStage === 'Untouched leads') return 'assigned';
  return null;
};

const mapStatusToParentStage = (status, nextFollowUpDate) => {
  if (status === 'enrolled' || status === 'registered') return 'Admission done';
  if (status === 'not_interested' || status === 'rejected') return 'Not interested';
  if (status === 'ringing') return 'Not responding';
  if (status === 'contacted') return 'Call back later';
  if (status === 'follow_up' || status === 'interested' || nextFollowUpDate) return 'Follow up';
  return 'Untouched leads';
};

const parseStageFromCallOutcome = (callOutcome) => {
  if (!callOutcome || typeof callOutcome !== 'string') return null;
  const text = callOutcome.trim();
  if (text === 'Details Updated' || text === 'Student details updated') return null;

  for (const pStage of LEAD_PARENT_STAGES_LIST) {
    if (text.toLowerCase().startsWith(pStage.toLowerCase())) {
      const remainder = text.slice(pStage.length).replace(/^\s*-\s*/, '').replace(/\s*\(Note Updated\)$/i, '').trim();
      return {
        leadStage: pStage,
        leadSubStage: remainder || (LEAD_SUB_STAGES_MAP[pStage] ? LEAD_SUB_STAGES_MAP[pStage][0] : '')
      };
    }
  }

  const lower = text.toLowerCase();
  if (lower.includes('ready to enroll') || lower.includes('enrolled') || lower.includes('admission done')) {
    return { leadStage: 'Admission done', leadSubStage: '' };
  }
  if (lower.includes('not interested')) {
    return { leadStage: 'Not interested', leadSubStage: 'enrolled somewhere else' };
  }
  if (lower.includes('ringing') || lower.includes('no response') || lower.includes('switched off') || lower.includes('not reachable') || lower.includes('invalid number') || lower.includes('wrong contact')) {
    let sub = 'not picked';
    if (lower.includes('switched off')) sub = 'switch off';
    else if (lower.includes('ringing')) sub = 'ringing no response';
    else if (lower.includes('not reachable')) sub = 'not reachable';
    else if (lower.includes('invalid') || lower.includes('wrong')) sub = 'wrong number';
    return { leadStage: 'Not responding', leadSubStage: sub };
  }
  if (lower.includes('call back later') || lower.includes('busy')) {
    return { leadStage: 'Call back later', leadSubStage: lower.includes('busy') ? 'was busy somewhere outside' : 'call back' };
  }
  if (lower.includes('follow-up') || lower.includes('follow up') || lower.includes('interested') || lower.includes('discussing with parents')) {
    let sub = 'need time to think';
    if (lower.includes('parents')) sub = 'want to consult parents';
    return { leadStage: 'Follow up', leadSubStage: sub };
  }
  return null;
};

const resolveEffectiveLeadStage = (student) => {
  if (!student) return { leadStage: 'Untouched leads', leadSubStage: 'never contacted', counselingStatus: 'assigned' };

  // 1. Check most recent callLog that specifies a stage (callLogs are sorted newest-first via unshift, but verify timestamps)
  if (Array.isArray(student.callLogs) && student.callLogs.length > 0) {
    const sortedLogs = [...student.callLogs].sort((a, b) => {
      const tA = new Date(a.calledAt || a.createdAt || 0).getTime();
      const tB = new Date(b.calledAt || b.createdAt || 0).getTime();
      return tB - tA;
    });

    const hasTouchedHistory =
      sortedLogs.some((l) => {
        const p = parseStageFromCallOutcome(l.callOutcome);
        return p && p.leadStage && p.leadStage !== 'Untouched leads';
      }) ||
      (student.leadStage && student.leadStage !== 'Untouched leads' && student.leadStage !== 'Untouched') ||
      (student.counselingStatus && !['assigned', 'unassigned', ''].includes(student.counselingStatus)) ||
      Boolean(student.nextFollowUpDate);

    for (const log of sortedLogs) {
      const parsed = parseStageFromCallOutcome(log.callOutcome);
      if (parsed && parsed.leadStage) {
        // Never let an accidental "Untouched leads" details-update log override a lead that has touched history
        if (
          parsed.leadStage === 'Untouched leads' &&
          (hasTouchedHistory || (log.notes || '').trim() === 'Student details updated')
        ) {
          continue;
        }
        const resolvedSub = parsed.leadSubStage || (student.leadStage === parsed.leadStage ? student.leadSubStage : '') || (LEAD_SUB_STAGES_MAP[parsed.leadStage]?.[0] || '');
        const resolvedStatus = mapParentStageToStatus(parsed.leadStage) || student.counselingStatus || 'assigned';
        return {
          leadStage: parsed.leadStage,
          leadSubStage: resolvedSub,
          counselingStatus: resolvedStatus
        };
      }
    }
  }

  // 2. Check top-level leadStage if valid
  if (student.leadStage && LEAD_PARENT_STAGES_LIST.includes(student.leadStage)) {
    // Guard against stale "Untouched leads" when counselingStatus or follow-up clearly shows touched state
    if (student.leadStage === 'Untouched leads' && student.counselingStatus && student.counselingStatus !== 'assigned' && student.counselingStatus !== 'unassigned') {
      const mappedStage = mapStatusToParentStage(student.counselingStatus, student.nextFollowUpDate);
      if (mappedStage !== 'Untouched leads') {
        return {
          leadStage: mappedStage,
          leadSubStage: (LEAD_SUB_STAGES_MAP[mappedStage]?.includes(student.leadSubStage) ? student.leadSubStage : LEAD_SUB_STAGES_MAP[mappedStage]?.[0]) || '',
          counselingStatus: student.counselingStatus
        };
      }
    }
    return {
      leadStage: student.leadStage,
      leadSubStage: student.leadSubStage || (LEAD_SUB_STAGES_MAP[student.leadStage]?.[0] || ''),
      counselingStatus: mapParentStageToStatus(student.leadStage) || student.counselingStatus || 'assigned'
    };
  }

  // 3. Fallback to counselingStatus / nextFollowUpDate
  const fallbackStage = mapStatusToParentStage(student.counselingStatus || 'assigned', student.nextFollowUpDate);
  return {
    leadStage: fallbackStage,
    leadSubStage: student.leadSubStage || (LEAD_SUB_STAGES_MAP[fallbackStage]?.[0] || ''),
    counselingStatus: student.counselingStatus || mapParentStageToStatus(fallbackStage) || 'assigned'
  };
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

    const placementCollegeQuery = {
      ...studentCollegesQuery,
      source: { $nin: ['organic', 'Organic'] },
      college: { $ne: null, $nin: ['', '-', 'N/A', 'None', 'other', 'Other'] }
    };

    const [studentColleges, eventColleges, collegeDocs] = await Promise.all([
      Student.distinct('college', placementCollegeQuery),
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
    const { collegeName, course, semester, includeOrganic, includeDrive, includeExcel } = req.query;
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

    const incOrg = includeOrganic !== 'false' && includeOrganic !== false && includeOrganic !== undefined;
    const incDrv = includeDrive !== 'false' && includeDrive !== false && includeDrive !== undefined;
    const incXls = includeExcel !== 'false' && includeExcel !== false && includeExcel !== undefined;
    const hasSourceFilter = includeOrganic !== undefined || includeDrive !== undefined || includeExcel !== undefined;

    const organicSources = ['organic', 'Organic', 'website', 'web'];
    const excelSources = ['excel', 'Excel', 'import', 'Import', 'college_leads', 'bulk_import'];

    const sourceConditions = [];
    if (hasSourceFilter) {
      if (incOrg) sourceConditions.push({ source: { $in: organicSources } });
      if (incXls) sourceConditions.push({ source: { $in: excelSources } });
      if (incDrv) sourceConditions.push({ source: { $nin: [...organicSources, ...excelSources] } });
    }

    if (hasSourceFilter && sourceConditions.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          collegeName,
          totalStudents: 0,
          unassignedStudents: 0,
          matchingUnassigned: 0,
          courses: [],
          semesters: []
        }
      });
    }

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

    const sourceMatch = (hasSourceFilter && sourceConditions.length > 0 && sourceConditions.length < 3)
      ? { $or: sourceConditions }
      : null;

    // For TL: Available pool to assign = students currently assigned to this TL
    // For Admin: Available pool to assign = global unassigned students
    const unassignedMatch = isTL
      ? {
          $and: [
            baseCollegeMatch,
            { assignedTo: tlId },
            ...(sourceMatch ? [sourceMatch] : [])
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
            },
            ...(sourceMatch ? [sourceMatch] : [])
          ]
        };

    const tlScopeMatch = isTL
      ? {
          $and: [
            baseCollegeMatch,
            { $or: [{ assignedTo: tlId }, { assignedBy: tlId }] },
            ...(sourceMatch ? [sourceMatch] : [])
          ]
        }
      : (sourceMatch ? { $and: [baseCollegeMatch, sourceMatch] } : baseCollegeMatch);

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

    // Apply source filter to filteredConditions as well
    if (sourceMatch) filteredConditions.push(sourceMatch);

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
    const { collegeName, bdeId, count, course, semester, assignmentMode, includeOrganic, includeDrive, includeExcel } = req.body;
    const isTL = isTLRole(req.staff) && !isSuperAdminOrAdmin(req.staff);
    const tlId = req.staff?._id;

    // Build source filter (same logic as getPoolBreakdown)
    const incOrg = includeOrganic !== false && includeOrganic !== 'false' && includeOrganic !== undefined;
    const incDrv = includeDrive !== false && includeDrive !== 'false' && includeDrive !== undefined;
    const incXls = includeExcel !== false && includeExcel !== 'false' && includeExcel !== undefined;
    const hasSourceFilter = includeOrganic !== undefined || includeDrive !== undefined || includeExcel !== undefined;

    const organicSourcesAssign = ['organic', 'Organic', 'website', 'web'];
    const excelSourcesAssign = ['excel', 'Excel', 'import', 'Import', 'college_leads', 'bulk_import'];

    const sourceConditionsAssign = [];
    if (hasSourceFilter) {
      if (incOrg) sourceConditionsAssign.push({ source: { $in: organicSourcesAssign } });
      if (incXls) sourceConditionsAssign.push({ source: { $in: excelSourcesAssign } });
      if (incDrv) sourceConditionsAssign.push({ source: { $nin: [...organicSourcesAssign, ...excelSourcesAssign] } });
    }

    const assignSourceMatch = (hasSourceFilter && sourceConditionsAssign.length > 0 && sourceConditionsAssign.length < 3)
      ? { $or: sourceConditionsAssign }
      : null;

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

    // Apply source filter to assignment pool
    if (assignSourceMatch) andConditions.push(assignSourceMatch);

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
    // Only set counselingStatus to 'assigned' for leads that don't already have an active counseling status
    await Student.updateMany(
      { _id: { $in: studentIds } },
      {
        $set: {
          assignedTo: bde._id,
          assignedBy: req.staff?._id || null,
          assignedAt: new Date()
        }
      }
    );
    // Update counselingStatus only for students without an active status
    await Student.updateMany(
      {
        _id: { $in: studentIds },
        $or: [
          { counselingStatus: { $in: ['unassigned', 'assigned', ''] } },
          { counselingStatus: { $exists: false } },
          { counselingStatus: null }
        ]
      },
      { $set: { counselingStatus: 'assigned' } }
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
    // STRICT RULE: Only Super Admin and Admin can unassign leads (NOT TL or counselors)
    const staff = req.staff || req.user;
    const staffRole = (staff?.role || staff?.systemRole || '').toLowerCase();
    const isAllowed = ['superadmin', 'super_admin', 'admin', 'director'].includes(staffRole);
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Super Admin and Admin can unassign leads. Team Leads and Counselors do not have unassign permissions.'
      });
    }

    const isTL = false;
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
    const isSuperAdmin = req.staff && ['super_admin', 'superadmin', 'admin', 'director', 'hr', 'hr_manager'].includes(req.staff.role || req.staff.systemRole);
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

    // Update counselingStatus to 'assigned' for any reassigned leads that had unassigned/empty status
    await Student.updateMany(
      {
        _id: { $in: studentIds },
        $or: [
          { counselingStatus: { $in: ['unassigned', 'assigned', ''] } },
          { counselingStatus: { $exists: false } },
          { counselingStatus: null }
        ]
      },
      { $set: { counselingStatus: 'assigned' } }
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
    const { counselingStatus, counselingNotes, leadStage, leadSubStage } = req.body;
    const loggedInStaff = req.staff || {};

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (counselingStatus) {
      student.counselingStatus = counselingStatus;
      const mappedStage = leadStage || mapStatusToParentStage(counselingStatus, student.nextFollowUpDate);
      if (mappedStage) {
        student.leadStage = mappedStage;
        const validSubs = LEAD_SUB_STAGES_MAP[mappedStage] || [];
        if (leadSubStage && validSubs.includes(leadSubStage)) {
          student.leadSubStage = leadSubStage;
        } else if (!student.leadSubStage || !validSubs.includes(student.leadSubStage)) {
          student.leadSubStage = validSubs[0] || '';
        }
      }
    } else if (leadStage) {
      student.leadStage = leadStage;
      const mappedSt = mapParentStageToStatus(leadStage);
      if (mappedSt) student.counselingStatus = mappedSt;
      const validSubs = LEAD_SUB_STAGES_MAP[leadStage] || [];
      if (leadSubStage && validSubs.includes(leadSubStage)) {
        student.leadSubStage = leadSubStage;
      } else if (!student.leadSubStage || !validSubs.includes(student.leadSubStage)) {
        student.leadSubStage = validSubs[0] || '';
      }
    }

    if (counselingNotes !== undefined) {
      student.counselingNotes = counselingNotes;
    }

    student.lastTouchedAt = new Date();
    if (student.leadStage && student.leadStage !== 'Untouched leads') {
      student.lastContactedAt = student.lastContactedAt || new Date();
    }
    student.lastTouchedBy = loggedInStaff._id || null;
    student.lastTouchedByName = loggedInStaff.fullName || `${loggedInStaff.firstName || ''} ${loggedInStaff.lastName || ''}`.trim() || 'Staff';

    if (counselingStatus || leadStage || counselingNotes) {
      const outcomeLabel = student.leadStage
        ? `${student.leadStage}${student.leadSubStage ? ` - ${student.leadSubStage}` : ''}`
        : (counselingStatus || 'Status Updated');
      if (!Array.isArray(student.callLogs)) student.callLogs = [];
      student.callLogs.unshift({
        calledAt: new Date(),
        calledBy: loggedInStaff._id || null,
        calledByName: student.lastTouchedByName,
        callOutcome: outcomeLabel,
        notes: counselingNotes || `Counseling status updated to ${student.leadStage || counselingStatus}`,
        nextFollowUpDate: student.nextFollowUpDate || null
      });
    }

    await student.save();
    await student.populate('assignedTo', 'fullName email designation');

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
      action: `Updated counseling status to "${student.leadStage || counselingStatus || 'updated'}"`,
      target: student?.fullName || 'Student',
      targetId: id,
      targetModel: 'Student',
      metadata: {
        newStatus: student.counselingStatus,
        leadStage: student.leadStage,
        leadSubStage: student.leadSubStage,
        notes: counselingNotes,
        studentEmail: student?.email
      }
    }).catch(err => console.error('Error logging status activity:', err));

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

    // Determine target counselor and permissions:
    const staffRole = (loggedInStaff.role || '').toLowerCase();
    const staffSystemRole = (loggedInStaff.systemRole || '').toLowerCase();
    const isSuperAdminOrAdminUser = ['super_admin', 'superadmin', 'admin', 'director', 'hr', 'hr_manager'].includes(staffRole) ||
      ['super_admin', 'superadmin', 'admin', 'director', 'hr', 'hr_manager'].includes(staffSystemRole);
    const isTL = isTLRole(loggedInStaff) && !isSuperAdminOrAdminUser;
    const isPrivileged = isSuperAdminOrAdminUser || isTL;

    let targetStaffId = loggedInStaff._id;
    let baseCounselorFilter;

    if (!isPrivileged) {
      // STRICT ISOLATION FOR BDE COUNSELORS:
      // Regular BDE / Counselor can ONLY EVER see leads assigned directly to their own ID!
      // Any query params trying to view 'all' or another counselor are strictly ignored.
      targetStaffId = loggedInStaff._id;
      baseCounselorFilter = { assignedTo: loggedInStaff._id };
    } else if (req.query.counselorId && req.query.counselorId !== 'all') {
      // Privileged user viewing a specific counselor
      targetStaffId = req.query.counselorId;
      baseCounselorFilter = { assignedTo: new mongoose.Types.ObjectId(targetStaffId) };
    } else if (req.query.counselorId === 'all') {
      // Privileged user viewing all leads under their purview
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
      // Privileged user without counselorId param:
      if (isTL) {
        baseCounselorFilter = { assignedTo: loggedInStaff._id };
      } else {
        baseCounselorFilter = { assignedTo: { $ne: null } };
      }
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

    // Self-heal / synchronize leadStage, leadSubStage, and counselingStatus for all leads of this counselor
    // so that any student whose stage was previously overwritten or only logged in callLogs is accurately classified.
    const allCounselorLeads = await Student.find(baseCounselorFilter)
      .select('_id isDummy dummyInfo leadStage leadSubStage counselingStatus lastContactedAt nextFollowUpDate callLogs')
      .lean();

    const bulkSyncOps = [];
    const stageCounts = {
      all: 0,
      'Untouched leads': 0,
      'Follow up': 0,
      'Not responding': 0,
      'Call back later': 0,
      'Not interested': 0,
      'Admission done': 0,
      dummy: 0
    };
    const subStageCounts = {};

    allCounselorLeads.forEach(s => {
      if (s.isDummy) {
        stageCounts.dummy = (stageCounts.dummy || 0) + 1;
        return;
      }
      stageCounts.all++;

      const resolved = resolveEffectiveLeadStage(s);
      const effectiveStage = resolved.leadStage;
      const effectiveSubStage = resolved.leadSubStage;
      const effectiveStatus = resolved.counselingStatus;

      if (stageCounts[effectiveStage] !== undefined) {
        stageCounts[effectiveStage]++;
      } else {
        stageCounts['Untouched leads']++;
      }

      if (effectiveSubStage) {
        const subKey = `${effectiveStage}::${effectiveSubStage}`;
        subStageCounts[subKey] = (subStageCounts[subKey] || 0) + 1;
        subStageCounts[effectiveSubStage] = (subStageCounts[effectiveSubStage] || 0) + 1;
      }

      let cleanedLogs = null;
      if (effectiveStage !== 'Untouched leads' && Array.isArray(s.callLogs) && s.callLogs.length > 0) {
        const filtered = s.callLogs.filter(l => {
          const p = parseStageFromCallOutcome(l.callOutcome);
          if (p && p.leadStage === 'Untouched leads' && (l.notes || '').trim() === 'Student details updated') {
            return false;
          }
          return true;
        });
        if (filtered.length !== s.callLogs.length) {
          cleanedLogs = filtered;
        }
      }

      if (
        s.leadStage !== effectiveStage ||
        (effectiveSubStage && s.leadSubStage !== effectiveSubStage) ||
        (effectiveStatus && s.counselingStatus !== effectiveStatus) ||
        cleanedLogs !== null
      ) {
        const setFields = { leadStage: effectiveStage };
        if (effectiveSubStage) setFields.leadSubStage = effectiveSubStage;
        if (effectiveStatus) setFields.counselingStatus = effectiveStatus;
        if (effectiveStage !== 'Untouched leads' && !s.lastContactedAt) {
          setFields.lastContactedAt = new Date();
        }
        if (cleanedLogs !== null) {
          setFields.callLogs = cleanedLogs;
        }
        bulkSyncOps.push({
          updateOne: {
            filter: { _id: s._id },
            update: { $set: setFields }
          }
        });
      }
    });

    if (bulkSyncOps.length > 0) {
      await Student.bulkWrite(bulkSyncOps).catch(err => console.warn('Bulk stage sync warning:', err.message));
    }

    if (leadStage === 'dummy') {
      andConditions.push({ isDummy: true });
    } else {
      andConditions.push({ isDummy: { $ne: true } });

      if (leadStage && leadStage !== 'all') {
        if (leadStage === 'Untouched leads' || leadStage === 'Untouched') {
          andConditions.push({
            $and: [
              {
                $or: [
                  { leadStage: { $in: ['Untouched leads', 'Untouched', '', null] } },
                  { leadStage: { $exists: false } }
                ]
              },
              {
                counselingStatus: {
                  $nin: ['follow_up', 'interested', 'contacted', 'ringing', 'not_interested', 'rejected', 'enrolled', 'registered']
                }
              },
              {
                $or: [
                  { nextFollowUpDate: null },
                  { nextFollowUpDate: { $exists: false } }
                ]
              }
            ]
          });
        } else if (leadStage === 'Admission done') {
          andConditions.push({
            $or: [
              { leadStage: 'Admission done' },
              {
                $and: [
                  { $or: [{ leadStage: '' }, { leadStage: null }, { leadStage: { $exists: false } }, { leadStage: 'Untouched leads' }] },
                  { counselingStatus: { $in: ['enrolled', 'registered'] } }
                ]
              }
            ]
          });
        } else if (leadStage === 'Not interested') {
          andConditions.push({
            $or: [
              { leadStage: 'Not interested' },
              {
                $and: [
                  { $or: [{ leadStage: '' }, { leadStage: null }, { leadStage: { $exists: false } }, { leadStage: 'Untouched leads' }] },
                  { counselingStatus: { $in: ['not_interested', 'rejected'] } }
                ]
              }
            ]
          });
        } else if (leadStage === 'Not responding') {
          andConditions.push({
            $or: [
              { leadStage: 'Not responding' },
              {
                $and: [
                  { $or: [{ leadStage: '' }, { leadStage: null }, { leadStage: { $exists: false } }, { leadStage: 'Untouched leads' }] },
                  { counselingStatus: 'ringing' }
                ]
              }
            ]
          });
        } else if (leadStage === 'Call back later') {
          andConditions.push({
            $or: [
              { leadStage: 'Call back later' },
              {
                $and: [
                  { $or: [{ leadStage: '' }, { leadStage: null }, { leadStage: { $exists: false } }, { leadStage: 'Untouched leads' }] },
                  { counselingStatus: 'contacted' }
                ]
              }
            ]
          });
        } else if (leadStage === 'Follow up') {
          andConditions.push({
            $or: [
              { leadStage: 'Follow up' },
              {
                $and: [
                  { $or: [{ leadStage: '' }, { leadStage: null }, { leadStage: { $exists: false } }, { leadStage: 'Untouched leads' }] },
                  {
                    $or: [
                      { counselingStatus: { $in: ['follow_up', 'interested'] } },
                      {
                        $and: [
                          { nextFollowUpDate: { $ne: null } },
                          { counselingStatus: { $nin: ['enrolled', 'registered', 'not_interested', 'rejected', 'ringing', 'contacted'] } }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          });
        } else {
          andConditions.push({ leadStage });
        }
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
      distinctOrganicColleges,
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
      Student.countDocuments({ ...baseCounselorFilter, isDummy: { $ne: true } }),
      Student.aggregate([
        { $match: baseCounselorFilter },
        {
          $group: {
            _id: '$counselingStatus',
            count: { $sum: 1 }
          }
        }
      ]),
      Student.distinct('college', {
        ...baseCounselorFilter,
        source: { $nin: ['organic', 'Organic'] },
        college: { $ne: null, $nin: ['', '-', 'N/A', 'None', 'other', 'Other'] }
      }),
      Student.distinct('college', {
        ...baseCounselorFilter,
        source: { $in: ['organic', 'Organic'] },
        college: { $ne: null, $nin: ['', '-', 'N/A', 'None', 'other', 'Other'] }
      }),
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

    // Ensure returned students have their resolved effective leadStage, leadSubStage, and counselingStatus attached
    students.forEach(s => {
      const resolved = resolveEffectiveLeadStage(s);
      s.leadStage = resolved.leadStage;
      s.leadSubStage = resolved.leadSubStage;
      s.counselingStatus = resolved.counselingStatus;
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
        organicColleges: (distinctOrganicColleges || []).filter(Boolean).sort(),
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

    // Dynamically persist course track in RegistrationCourse collection
    if (newSlip.technology) {
      await ensureRegistrationCourseExists(newSlip.technology, loggedInStaff?._id);
    }
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
    const { studentId, callOutcome, notes, nextFollowUpDate, counselingStatus, leadStage, leadSubStage } = req.body;
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
    student.lastTouchedAt = new Date();
    student.lastTouchedBy = loggedInStaff._id || null;
    student.lastTouchedByName = newLog.calledByName;

    if (followUpDate) {
      student.nextFollowUpDate = followUpDate;
    }
    if (cleanNotes) {
      student.counselingNotes = cleanNotes;
    }

    const lowerOutcome = outcome.toLowerCase();
    if (counselingStatus) {
      student.counselingStatus = counselingStatus;
    } else {
      if (lowerOutcome.includes('not interested') || lowerOutcome.includes('not_interested')) {
        student.counselingStatus = 'not_interested';
      } else if (lowerOutcome.includes('registered') || lowerOutcome.includes('enrolled') || lowerOutcome.includes('ready to enroll')) {
        student.counselingStatus = 'enrolled';
      } else if (lowerOutcome.includes('ringing') || lowerOutcome.includes('no_answer') || lowerOutcome.includes('no response') || lowerOutcome.includes('switched off') || lowerOutcome.includes('not reachable') || lowerOutcome.includes('invalid number')) {
        student.counselingStatus = 'ringing';
      } else if (lowerOutcome.includes('call back later') || lowerOutcome.includes('busy')) {
        student.counselingStatus = 'contacted';
      } else if (lowerOutcome.includes('interested')) {
        student.counselingStatus = 'interested';
      } else if (lowerOutcome.includes('follow_up') || lowerOutcome.includes('follow-up') || lowerOutcome.includes('discussing with parents') || followUpDate) {
        student.counselingStatus = 'follow_up';
      } else {
        student.counselingStatus = 'contacted';
      }
    }

    // Synchronize leadStage and leadSubStage so stage tabs always reflect the latest call log
    if (leadStage && LEAD_PARENT_STAGES_LIST.includes(leadStage)) {
      student.leadStage = leadStage;
      if (leadSubStage) student.leadSubStage = leadSubStage;
      else if (!student.leadSubStage || !(LEAD_SUB_STAGES_MAP[leadStage] || []).includes(student.leadSubStage)) {
        student.leadSubStage = LEAD_SUB_STAGES_MAP[leadStage]?.[0] || '';
      }
    } else {
      const parsedFromOutcome = parseStageFromCallOutcome(outcome);
      const mappedStage = (counselingStatus ? mapStatusToParentStage(counselingStatus, followUpDate) : null) || parsedFromOutcome?.leadStage || mapStatusToParentStage(student.counselingStatus, followUpDate);
      if (mappedStage) {
        student.leadStage = mappedStage;
        if (leadSubStage) {
          student.leadSubStage = leadSubStage;
        } else if (parsedFromOutcome?.leadSubStage && parsedFromOutcome.leadStage === mappedStage) {
          student.leadSubStage = parsedFromOutcome.leadSubStage;
        } else if (!student.leadSubStage || !(LEAD_SUB_STAGES_MAP[mappedStage] || []).includes(student.leadSubStage)) {
          student.leadSubStage = LEAD_SUB_STAGES_MAP[mappedStage]?.[0] || '';
        }
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
        leadStage: student.leadStage,
        leadSubStage: student.leadSubStage,
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

    // Resolve effective lead stage so LeadDetailsScreen always receives the accurate latest stage
    const resolvedStage = resolveEffectiveLeadStage(student);
    const setFields = {};
    if (student.leadStage !== resolvedStage.leadStage) {
      student.leadStage = resolvedStage.leadStage;
      setFields.leadStage = resolvedStage.leadStage;
    }
    if (resolvedStage.leadSubStage && student.leadSubStage !== resolvedStage.leadSubStage) {
      student.leadSubStage = resolvedStage.leadSubStage;
      setFields.leadSubStage = resolvedStage.leadSubStage;
    }
    if (resolvedStage.counselingStatus && student.counselingStatus !== resolvedStage.counselingStatus) {
      student.counselingStatus = resolvedStage.counselingStatus;
      setFields.counselingStatus = resolvedStage.counselingStatus;
    }

    // Clean up any accidental "Untouched leads - never contacted" log with "Student details updated" when lead is in a touched stage
    if (resolvedStage.leadStage !== 'Untouched leads' && Array.isArray(student.callLogs) && student.callLogs.length > 0) {
      const cleanedLogs = student.callLogs.filter(l => {
        const p = parseStageFromCallOutcome(l.callOutcome);
        if (p && p.leadStage === 'Untouched leads' && (l.notes || '').trim() === 'Student details updated') {
          return false;
        }
        return true;
      });
      if (cleanedLogs.length !== student.callLogs.length) {
        student.callLogs = cleanedLogs;
        setFields.callLogs = cleanedLogs;
      }
    }

    if (Object.keys(setFields).length > 0) {
      await Student.updateOne(
        { _id: student._id },
        { $set: setFields }
      ).catch(() => null);
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
      nextFollowUpDate,
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

    // Determine student's existing effective stage BEFORE applying updates so profile-only edits never reset stage
    const priorResolved = resolveEffectiveLeadStage(student);

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
    if (nextFollowUpDate !== undefined) {
      student.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;
    }

    // Stage updates: only mark stageChanged if leadStage or leadSubStage is explicitly provided
    let stageChanged = false;
    if (leadStage) {
      student.leadStage = leadStage;
      stageChanged = true;
    } else if (!student.leadStage && priorResolved.leadStage) {
      student.leadStage = priorResolved.leadStage;
    }

    if (leadSubStage !== undefined) {
      student.leadSubStage = leadSubStage;
      stageChanged = true;
    } else if (!student.leadSubStage && priorResolved.leadSubStage) {
      student.leadSubStage = priorResolved.leadSubStage;
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
      } else if (leadStage === 'Untouched leads') {
        student.counselingStatus = 'assigned';
      }
    } else if (counselingStatus) {
      student.counselingStatus = counselingStatus;
      const mappedFromStatus = mapStatusToParentStage(counselingStatus, student.nextFollowUpDate);
      if (mappedFromStatus) {
        student.leadStage = mappedFromStatus;
        const validSubs = LEAD_SUB_STAGES_MAP[mappedFromStatus] || [];
        if (!student.leadSubStage || !validSubs.includes(student.leadSubStage)) {
          student.leadSubStage = validSubs[0] || '';
        }
      }
    } else if (priorResolved.counselingStatus && (!student.counselingStatus || student.counselingStatus === 'assigned')) {
      student.counselingStatus = priorResolved.counselingStatus;
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
    if (stageChanged || counselingNotes || counselingStatus || student.leadStage !== 'Untouched leads') {
      student.lastContactedAt = new Date();
    }
    student.lastTouchedBy = loggedInStaff._id || null;
    student.lastTouchedByName = loggedInStaff.fullName || `${loggedInStaff.firstName || ''} ${loggedInStaff.lastName || ''}`.trim() || 'Staff';

    // Add entry to callLogs timeline ONLY when stage changed, demo/admission booked, or notes were explicitly provided
    if (stageChanged || counselingNotes || demoTiming || admissionTechnology) {
      const activeStage = student.leadStage || priorResolved.leadStage || 'Follow up';
      const activeSubStage = student.leadSubStage || priorResolved.leadSubStage || '';
      const stageLogText = stageChanged
        ? `${activeStage}${activeSubStage ? ` - ${activeSubStage}` : ''}`
        : `${activeStage}${activeSubStage ? ` - ${activeSubStage}` : ''} (Note Updated)`;
      if (!Array.isArray(student.callLogs)) student.callLogs = [];
      student.callLogs.unshift({
        calledAt: new Date(),
        calledBy: loggedInStaff._id || null,
        calledByName: student.lastTouchedByName,
        callOutcome: stageLogText,
        notes: counselingNotes || (demoTiming ? `Demo scheduled: ${demoTechnology} on ${new Date(demoTiming).toLocaleString()}` : (admissionTechnology ? `Enrolled in ${admissionTechnology}` : `Stage updated to ${activeStage}${activeSubStage ? ` (${activeSubStage})` : ''}`)),
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

// 18. Mark Student as Dummy / Duplicate Lead
exports.markStudentAsDummy = async (req, res) => {
  try {
    const studentId = req.params.id;
    const { reasonCategory, reasonNotes, duplicateOf } = req.body;
    const staff = req.staff;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const staffName = staff.fullName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Staff';
    const staffRole = staff.role || staff.systemRole || 'Counselor';

    student.isDummy = true;
    student.dummyInfo = {
      isDummy: true,
      markedBy: staff._id,
      markedByName: staffName,
      markedByRole: staffRole,
      markedAt: new Date(),
      reasonCategory: reasonCategory || 'Duplicate Lead (Same Student)',
      reasonNotes: (reasonNotes || '').trim(),
      duplicateOf: duplicateOf ? new mongoose.Types.ObjectId(duplicateOf) : null,
      unmarkedBy: null,
      unmarkedByName: '',
      unmarkedAt: null
    };

    await student.save();

    // Log Activity
    try {
      await logActivity({
        staffId: staff._id,
        action: 'MARK_STUDENT_DUMMY',
        details: `Marked student ${student.fullName} (${student.phoneNumber || student.email}) as dummy. Reason: ${reasonCategory || 'Duplicate Lead'}. ${reasonNotes || ''}`,
        targetId: student._id,
        targetType: 'Student'
      });
    } catch (actErr) {
      console.warn('Could not log activity for mark dummy:', actErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Student marked as dummy successfully',
      data: student
    });
  } catch (error) {
    console.error('Error marking student as dummy:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 19. Unmark Student as Dummy (Restore)
exports.unmarkStudentAsDummy = async (req, res) => {
  try {
    const studentId = req.params.id;
    const staff = req.staff;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const staffName = staff.fullName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Staff';

    student.isDummy = false;
    if (student.dummyInfo) {
      student.dummyInfo.isDummy = false;
      student.dummyInfo.unmarkedBy = staff._id;
      student.dummyInfo.unmarkedByName = staffName;
      student.dummyInfo.unmarkedAt = new Date();
    }

    await student.save();

    // Log Activity
    try {
      await logActivity({
        staffId: staff._id,
        action: 'UNMARK_STUDENT_DUMMY',
        details: `Restored student ${student.fullName} (${student.phoneNumber || student.email}) from dummy.`,
        targetId: student._id,
        targetType: 'Student'
      });
    } catch (actErr) {
      console.warn('Could not log activity for unmark dummy:', actErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Student restored from dummy successfully',
      data: student
    });
  } catch (error) {
    console.error('Error restoring student from dummy:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET/POST /api/counselor/registration/receipt-preview/:slipId?
 * Stream in-memory PDF preview for counselor to view before generating or approving
 */
exports.previewRegistrationReceipt = async (req, res) => {
  try {
    const { slipId } = req.params;
    let slip = null;
    let student = null;

    if (slipId && slipId !== 'preview') {
      const isObjectId = mongoose.Types.ObjectId.isValid(slipId);
      slip = isObjectId
        ? await RegistrationSlip.findById(slipId).populate('student')
        : await RegistrationSlip.findOne({ registrationNo: slipId }).populate('student');
      if (slip) {
        student = slip.student;
      }
    } else if (req.body && req.body.studentId) {
      student = await Student.findById(req.body.studentId);
    }

    const receiptService = require('../../src/services/receiptService');
    const pdfBuffer = await receiptService.generateReceiptPdf({
      registrationNo: slip ? slip.registrationNo : (req.body.registrationNo || 'WPX-PREVIEW'),
      date: slip ? (slip.verifiedAt || slip.date) : (req.body.date || new Date()),
      studentName: student ? student.fullName : (req.body.studentName || 'Student Name'),
      fatherName: slip?.fatherName || student?.fatherName || req.body.fatherName || '',
      contactNo: student?.phoneNumber || slip?.contactNo || req.body.contactNo || '',
      email: student?.email || slip?.email || req.body.email || '',
      address: slip?.address || student?.address || student?.city || req.body.address || '',
      technology: slip?.registeredTechnology || slip?.technology || student?.registeredTechnology || student?.admissionTechnology || req.body.technology || 'Training Track',
      duration: slip?.duration || student?.trainingDuration || req.body.duration || '6 Months',
      totalFee: slip?.totalFee || student?.totalFee || req.body.totalFee || 25000,
      paidAmount: slip?.paidAmount || req.body.paidAmount || 0,
      dueAmount: slip?.dueAmount !== undefined ? slip.dueAmount : (req.body.dueAmount || 0),
      paymentMode: slip?.paymentMode || req.body.paymentMode || 'UPI',
      nextDueDate: slip?.nextDueDate || student?.nextDueDate || req.body.nextDueDate || ''
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="receipt-preview.pdf"');
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating receipt preview:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/counselor/registration/receipt-pdf/:identifier
 * Download official tamper-proof PDF receipt
 */
exports.downloadRegistrationReceiptPdf = async (req, res) => {
  try {
    const { identifier } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    const slip = isObjectId
      ? await RegistrationSlip.findById(identifier).populate('student')
      : await RegistrationSlip.findOne({ registrationNo: identifier }).populate('student');

    if (!slip) {
      return res.status(404).json({ success: false, message: 'Registration receipt not found.' });
    }

    const receiptService = require('../../src/services/receiptService');
    let filePath = receiptService.getReceiptPdfPath(slip.registrationNo);
    let pdfBuffer = null;

    if (filePath && fs.existsSync(filePath)) {
      pdfBuffer = fs.readFileSync(filePath);
    } else {
      const generated = await receiptService.generateAndSaveReceipt(slip, slip.student || {});
      pdfBuffer = generated.pdfBuffer;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Wipronix_Receipt_${slip.registrationNo}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error downloading receipt PDF:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/counselor/registration/resend-receipt-whatsapp/:slipId
 * Resend official fee receipt on WhatsApp to student & return direct WhatsApp link
 */
exports.resendReceiptOnWhatsApp = async (req, res) => {
  try {
    const { slipId } = req.params;
    const slip = await RegistrationSlip.findById(slipId).populate('student');
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Registration slip not found.' });
    }

    const student = slip.student;
    if (!student || !student.phoneNumber) {
      return res.status(400).json({ success: false, message: 'Student phone number not found.' });
    }

    const receiptService = require('../../src/services/receiptService');
    await receiptService.generateAndSaveReceipt(slip, student);

    const frontendBase = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://www.wipronix.com').replace(/\/+$/, '');
    const pdfDownloadUrl = `${frontendBase}/receipt/${slip.registrationNo}`;
    slip.pdfUrl = pdfDownloadUrl;
    await slip.save();

    const cleanDigits = (student.phoneNumber || '').toString().replace(/\D/g, '');
    const formattedMobile = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

    const messageText = `🎓 *WIPRONIX TECHNOLOGIES — OFFICIAL REGISTRATION RECEIPT* 🎓\n\nDear *${student.fullName}*,\n\nYour registration payment for *${slip.registeredTechnology || slip.technology || 'Training Program'}* has been successfully verified & confirmed.\n\n📄 *Registration Ref:* ${slip.registrationNo}\n💰 *Registration Fee Paid:* ₹${Number(slip.paidAmount || 0).toLocaleString()}\n💳 *Net Remaining Fee:* ₹${Number(slip.dueAmount || 0).toLocaleString()}\n📅 *Date:* ${receiptService.formatDate(slip.verifiedAt || slip.date)}\n\n📥 *Download Your Official PDF Receipt (Tamper-Proof):*\n${pdfDownloadUrl}\n\n_Note: Please keep this official receipt safe for your training records._`;

    const whatsappDirectUrl = `https://api.whatsapp.com/send?phone=${formattedMobile}&text=${encodeURIComponent(messageText)}`;

    try {
      const msgStudio = require('../../src/services/msgStudioService');
      await msgStudio.sendWhatsAppTemplate({
        mobile: formattedMobile,
        variables: [
          student.fullName,
          slip.registrationNo,
          `₹${Number(slip.paidAmount || 0).toLocaleString()}`,
          pdfDownloadUrl
        ],
        mediaUrl: pdfDownloadUrl
      });
    } catch (waErr) {
      console.warn('MsgStudio dispatch note in resend:', waErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Registration receipt prepared for ${student.fullName}.`,
      data: {
        pdfUrl: pdfDownloadUrl,
        whatsappDirectUrl,
        mobile: formattedMobile,
        registrationNo: slip.registrationNo
      }
    });
  } catch (error) {
    console.error('Error resending receipt on WhatsApp:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/counselor/registration/search-students
 * Search students with college filter for manual slip creation
 */
exports.searchStudentsForSlip = async (req, res) => {
  try {
    const { search = '', college = '' } = req.query;
    const query = {};

    if (college && college.trim()) {
      query.college = { $regex: new RegExp(`^${college.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }

    if (search && search.trim()) {
      const s = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { fullName: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { phoneNumber: { $regex: s, $options: 'i' } }
      ];
    }

    const [students, distinctColleges] = await Promise.all([
      Student.find(query)
        .select('fullName email phoneNumber college course fatherName address city technology registeredTechnology admissionTechnology trainingDuration totalFee totalPaidFee dueAmount netRemainingFee isRegistrationVerified registrationSlipNo leadStage leadSubStage assignedTo')
        .populate('assignedTo', 'fullName email')
        .sort({ updatedAt: -1 })
        .limit(40),
      Student.distinct('college')
    ]);

    const cleanColleges = Array.from(new Set(distinctColleges.filter(Boolean).map(c => c.trim()))).sort();

    return res.status(200).json({
      success: true,
      data: {
        students,
        colleges: cleanColleges
      }
    });
  } catch (error) {
    console.error('Error searching students for slip:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/counselor/registration/manual-office-slip
 * Superadmin-only: Create in-office paid registration slip for existing or new student
 */
exports.createManualOfficeSlip = async (req, res) => {
  try {
    const loggedInStaff = req.staff || req.user;
    if (!loggedInStaff) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // Role check: Only Superadmin or authorized Admin
    if (!isSuperAdminOrAdmin(loggedInStaff)) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only Superadmin or authorized Admin can create manual office slips.'
      });
    }

    const {
      studentId,
      studentName,
      phoneNumber,
      email,
      college,
      course,
      fatherName,
      address,
      technology,
      duration = '6 Months',
      totalFee = 25000,
      discountAmount = 0,
      discountType = '',
      netFee,
      paidAmount = 0,
      dueAmount,
      paymentMode = 'Cash',
      transactionId,
      paymentScreenshotUrl,
      paymentScreenshots,
      nextDueDate,
      remarks,
      registrationNo: customRegNo,
      sendWhatsApp = false,
      assignedTo
    } = req.body;

    let student = null;

    if (studentId) {
      student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Selected student not found.' });
      }
      if (assignedTo) {
        student.assignedTo = assignedTo;
        student.assignedBy = loggedInStaff._id;
        student.assignedAt = new Date();
      }
    } else {
      // Find by phone or email or create new student
      const cleanPhone = (phoneNumber || '').toString().trim();
      const cleanEmail = (email || '').toString().trim().toLowerCase();

      if (!cleanPhone && !cleanEmail) {
        return res.status(400).json({ success: false, message: 'Student phone number or email is required.' });
      }

      if (!studentName || !studentName.trim()) {
        return res.status(400).json({ success: false, message: 'Student name is required.' });
      }

      const orQuery = [];
      if (cleanPhone) orQuery.push({ phoneNumber: cleanPhone });
      if (cleanEmail) orQuery.push({ email: cleanEmail });

      student = await Student.findOne({ $or: orQuery });

      if (student) {
        if (assignedTo) {
          student.assignedTo = assignedTo;
          student.assignedBy = loggedInStaff._id;
          student.assignedAt = new Date();
        }
      } else {
        student = new Student({
          fullName: studentName.trim(),
          phoneNumber: cleanPhone,
          email: cleanEmail || `${cleanPhone || Date.now()}@wipronix.local`,
          college: (college || 'Office Walk-in').trim(),
          course: (course || '').trim(),
          fatherName: (fatherName || '').trim(),
          address: (address || '').trim(),
          city: (address || '').trim(),
          technology: (technology || 'General').trim(),
          registeredTechnology: (technology || 'General').trim(),
          admissionTechnology: (technology || 'General').trim(),
          trainingDuration: duration,
          source: 'import',
          leadStage: 'Admission done',
          leadSubStage: (technology || 'General').trim(),
          assignedTo: assignedTo || loggedInStaff._id,
          assignedBy: loggedInStaff._id,
          assignedAt: new Date()
        });
        await student.save();
      }
    }

    const numTotal = Number(totalFee) || Number(student.totalFee) || 25000;
    const numPaid = Number(paidAmount) || 0;
    const calculatedDue = dueAmount !== undefined ? Number(dueAmount) : Math.max(0, numTotal - numPaid);

    // Generate unique REG NO
    const cleanDateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const regNo = customRegNo && customRegNo.trim()
      ? customRegNo.trim()
      : `WPX-${cleanDateCode}-${randomSuffix}`;

    // Determine effective transactionId & mode
    const isCashMode = (paymentMode || '').toLowerCase().includes('cash');
    const effectiveTransactionId = (transactionId && transactionId.trim())
      ? transactionId.trim()
      : (isCashMode ? 'CASH-PAYMENT' : '');

    // Upload any base64 payment screenshots to Cloudinary
    const incomingScreenshots = (Array.isArray(paymentScreenshots) && paymentScreenshots.length > 0)
      ? paymentScreenshots
      : (paymentScreenshotUrl ? [paymentScreenshotUrl] : []);
    const cloudinaryUrls = await uploadProofScreenshotsToCloudinary(incomingScreenshots);

    // Create RegistrationSlip
    const newSlip = new RegistrationSlip({
      student: student._id,
      issuedBy: loggedInStaff._id,
      registrationNo: regNo,
      fatherName: fatherName || student.fatherName || '',
      address: address || student.address || student.city || '',
      technology: technology || student.registeredTechnology || student.admissionTechnology || student.technology || 'General',
      registeredTechnology: technology || student.registeredTechnology || student.admissionTechnology || student.technology || 'General',
      duration: duration || student.trainingDuration || '6 Months',
      totalFee: numTotal,
      discountAmount: Number(discountAmount) || 0,
      discountType: (discountType || '').trim(),
      netFee: netFee !== undefined ? Number(netFee) : Math.max(0, numTotal - (Number(discountAmount) || 0)),
      paidAmount: numPaid,
      dueAmount: calculatedDue,
      paymentMode: paymentMode || 'Cash',
      mode: isCashMode ? 'In-Office' : 'Remote-QR',
      transactionId: effectiveTransactionId,
      paymentScreenshotUrl: cloudinaryUrls[0] || '',
      paymentScreenshots: cloudinaryUrls,
      studentSubmissionDate: (cloudinaryUrls.length > 0 || transactionId) ? new Date() : undefined,
      nextDueDate: nextDueDate || student.nextDueDate || null,
      status: 'Paid', // Office slips are paid & verified
      verifiedBy: loggedInStaff._id,
      verifiedByName: loggedInStaff.fullName || 'Superadmin',
      verifiedAt: new Date(),
      remarks: remarks || `Manual in-office slip entered by ${loggedInStaff.fullName || 'Superadmin'}`
    });

    await newSlip.save();

    // Update Student record with verified registration status & financials
    student.isRegistrationVerified = true;
    student.registrationSlipNo = regNo;
    student.leadStage = 'Admission done';
    student.leadSubStage = newSlip.registeredTechnology;
    student.registeredTechnology = newSlip.registeredTechnology;
    student.admissionTechnology = newSlip.registeredTechnology;
    student.trainingDuration = newSlip.duration;
    student.totalFee = numTotal;
    student.totalPaidFee = (student.totalPaidFee || 0) + numPaid;
    student.dueAmount = calculatedDue;
    student.netRemainingFee = calculatedDue;
    if (fatherName) student.fatherName = fatherName;
    if (address) { student.address = address; if (!student.city) student.city = address; }
    if (nextDueDate) student.nextDueDate = nextDueDate;
    student.activePaymentSlipId = newSlip._id;
    await student.save();

    // Ensure technology track is dynamically registered in RegistrationCourse collection
    if (newSlip.registeredTechnology) {
      await ensureRegistrationCourseExists(newSlip.registeredTechnology, loggedInStaff._id);
    }

    // Create FeePayment ledger record
    try {
      const FeePayment = require('../../models/FeePayment.model');
      const feePayment = new FeePayment({
        student: student._id,
        amount: numPaid,
        type: 'Registration',
        paymentMode: paymentMode || 'Cash',
        status: 'Paid',
        slipNumber: regNo,
        collectedBy: loggedInStaff._id,
        date: new Date(),
        remarks: remarks || 'Office manual registration slip payment'
      });
      await feePayment.save();
    } catch (ledgerErr) {
      console.warn('Ledger record creation note:', ledgerErr.message);
    }

    // Generate Official Tamper-Proof PDF Receipt
    const receiptService = require('../../src/services/receiptService');
    const receiptResult = await receiptService.generateAndSaveReceipt(newSlip, student);
    newSlip.receiptPdfPath = receiptResult.filePath;

    const frontendBase = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://www.wipronix.com').replace(/\/+$/, '');
    const pdfDownloadUrl = `${frontendBase}/receipt/${regNo}`;
    newSlip.pdfUrl = pdfDownloadUrl;
    await newSlip.save();

    // Send WhatsApp if requested
    if (sendWhatsApp && student.phoneNumber) {
      try {
        const cleanDigits = (student.phoneNumber || '').toString().replace(/\D/g, '');
        const formattedMobile = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
        const msgStudio = require('../../src/services/msgStudioService');
        await msgStudio.sendWhatsAppTemplate({
          mobile: formattedMobile,
          variables: [
            student.fullName,
            newSlip.registrationNo,
            `₹${numPaid.toLocaleString()}`,
            pdfDownloadUrl
          ],
          mediaUrl: pdfDownloadUrl
        });
      } catch (waErr) {
        console.warn('WhatsApp dispatch error in manual slip:', waErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Manual office slip ${regNo} created and verified for ${student.fullName}.`,
      data: {
        slip: newSlip,
        student,
        pdfUrl: pdfDownloadUrl
      }
    });
  } catch (error) {
    console.error('Error creating manual office slip:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * POST /api/counselor/registration/collect-installment
 * Superadmin strictly manages subsequent fee installments (2nd, 3rd installment, final balance)
 */
exports.collectStudentInstallment = async (req, res) => {
  try {
    const loggedInStaff = req.staff || req.user;
    if (!loggedInStaff) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!isSuperAdminOrAdmin(loggedInStaff)) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only Superadmin or authorized Admin can record fee installments.'
      });
    }

    const {
      studentId,
      installmentAmount,
      paymentMode = 'Cash',
      transactionId = '',
      paymentScreenshotUrl = '',
      nextDueDate,
      remarks,
      registrationNo: customRegNo,
      sendWhatsApp = true
    } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const numInstallment = Number(installmentAmount) || 0;
    if (numInstallment <= 0) {
      return res.status(400).json({ success: false, message: 'Valid installment amount is required.' });
    }

    // Previous slips to determine installment number
    const previousSlips = await RegistrationSlip.find({ student: student._id }).sort({ createdAt: 1 });
    const installmentNumber = previousSlips.length + 1;

    const currentTotalPaid = Number(student.totalPaidFee || 0);
    const newTotalPaid = currentTotalPaid + numInstallment;
    const totalFee = Number(student.totalFee || 25000);
    const newRemainingDue = Math.max(0, totalFee - newTotalPaid);

    // Generate unique slip reference
    const cleanDateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const regNo = customRegNo && customRegNo.trim()
      ? customRegNo.trim()
      : `WPX-${cleanDateCode}-${randomSuffix}`;

    // Upload any base64 payment screenshots to Cloudinary
    const incomingScreenshots = (Array.isArray(paymentScreenshots) && paymentScreenshots.length > 0)
      ? paymentScreenshots
      : (paymentScreenshotUrl ? [paymentScreenshotUrl] : []);
    const cloudinaryUrls = await uploadProofScreenshotsToCloudinary(incomingScreenshots);

    const newSlip = new RegistrationSlip({
      student: student._id,
      issuedBy: loggedInStaff._id,
      registrationNo: regNo,
      installmentNumber,
      fatherName: student.fatherName || '',
      address: student.address || student.city || '',
      technology: student.registeredTechnology || student.admissionTechnology || student.technology || 'Training Program',
      registeredTechnology: student.registeredTechnology || student.admissionTechnology || student.technology || 'Training Program',
      duration: student.trainingDuration || '6 Months',
      totalFee,
      paidAmount: numInstallment,
      dueAmount: newRemainingDue,
      paymentMode: paymentMode || 'Cash',
      mode: 'In-Office',
      transactionId: transactionId || '',
      paymentScreenshotUrl: cloudinaryUrls[0] || '',
      paymentScreenshots: cloudinaryUrls,
      studentSubmissionDate: (cloudinaryUrls.length > 0 || transactionId) ? new Date() : undefined,
      nextDueDate: nextDueDate || null,
      status: 'Paid',
      verifiedBy: loggedInStaff._id,
      verifiedByName: loggedInStaff.fullName || 'Superadmin',
      verifiedAt: new Date(),
      remarks: remarks || `Fee Installment #${installmentNumber} recorded by ${loggedInStaff.fullName || 'Superadmin'}`
    });

    await newSlip.save();

    // Update Student financials
    student.totalPaidFee = newTotalPaid;
    student.dueAmount = newRemainingDue;
    student.netRemainingFee = newRemainingDue;
    if (nextDueDate) {
      student.nextDueDate = nextDueDate;
    } else if (newRemainingDue === 0) {
      student.nextDueDate = null;
    }
    await student.save();

    // Ledger entry
    try {
      const FeePayment = require('../../models/FeePayment.model');
      const feePayment = new FeePayment({
        student: student._id,
        amount: numInstallment,
        type: `Installment #${installmentNumber}`,
        paymentMode: paymentMode || 'Cash',
        status: 'Paid',
        slipNumber: regNo,
        transactionId: transactionId || '',
        collectedBy: loggedInStaff._id,
        date: new Date(),
        remarks: remarks || `Installment #${installmentNumber} payment`
      });
      await feePayment.save();
    } catch (ledgerErr) {
      console.warn('Ledger error:', ledgerErr.message);
    }

    // Generate PDF receipt
    const receiptService = require('../../src/services/receiptService');
    const receiptResult = await receiptService.generateAndSaveReceipt(newSlip, student);
    newSlip.receiptPdfPath = receiptResult.filePath;

    const cleanFrontendBase = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://www.wipronix.com').replace(/\/+$/, '');
    const publicReceiptUrl = `${cleanFrontendBase}/receipt/${regNo}`;
    newSlip.pdfUrl = publicReceiptUrl;
    await newSlip.save();

    // WhatsApp dispatch
    if (sendWhatsApp && student.phoneNumber) {
      try {
        const cleanDigits = (student.phoneNumber || '').toString().replace(/\D/g, '');
        const formattedMobile = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
        const msgStudio = require('../../src/services/msgStudioService');
        await msgStudio.sendReceiptWhatsApp({
          studentPhone: formattedMobile,
          studentName: student.fullName,
          registrationNo: regNo,
          paidAmount: numInstallment,
          receiptUrl: publicReceiptUrl
        });
      } catch (waErr) {
        console.warn('WhatsApp dispatch error:', waErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: `Installment #${installmentNumber} of ₹${numInstallment.toLocaleString()} recorded for ${student.fullName}. Official receipt: ${regNo}`,
      data: {
        slip: newSlip,
        student,
        receiptUrl: publicReceiptUrl,
        installmentNumber
      }
    });
  } catch (error) {
    console.error('Error collecting installment:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/counselor/due-alerts
 * Counselors receive alerts for assigned students whose fee due date is near (within 7 days or overdue)
 */
exports.getUpcomingDueAlerts = async (req, res) => {
  try {
    const loggedInStaff = req.staff || req.user;
    if (!loggedInStaff) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const query = {
      isRegistrationVerified: true,
      $or: [
        { netRemainingFee: { $gt: 0 } },
        { dueAmount: { $gt: 0 } }
      ],
      nextDueDate: { $ne: null }
    };

    // If counselor / staff, filter by assignedTo
    if (!isSuperAdminOrAdmin(loggedInStaff)) {
      query.assignedTo = loggedInStaff._id;
    }

    const students = await Student.find(query)
      .populate('assignedTo', 'fullName email phoneNumber')
      .sort({ nextDueDate: 1 })
      .lean();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dueAlerts = [];

    for (const student of students) {
      if (!student.nextDueDate) continue;
      const dueDate = new Date(student.nextDueDate);
      const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const diffMs = dueDay.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Alert if due within 7 days, due today, or overdue
      if (diffDays <= 7) {
        let status = 'upcoming';
        let alertLabel = `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
        if (diffDays === 0) {
          status = 'today';
          alertLabel = 'Due Today';
        } else if (diffDays < 0) {
          status = 'overdue';
          alertLabel = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
        }

        const remainingFee = student.netRemainingFee !== undefined && student.netRemainingFee !== null ? student.netRemainingFee : student.dueAmount;
        const cleanPhone = (student.phoneNumber || '').toString().replace(/\D/g, '');
        const formattedMobile = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const reminderMsg = `🎓 *WIPRONIX TECHNOLOGIES — FEE DUE NOTICE* 🎓\\n\\nDear *${student.fullName}*,\\n\\nThis is a friendly reminder that your upcoming course fee installment of *₹${Number(remainingFee || 0).toLocaleString()}* for *${student.registeredTechnology || student.technology || 'Training'}* is scheduled for *${dueDate.toLocaleDateString('en-GB')}* (${alertLabel}).\\n\\nPlease connect with your counselor to ensure uninterrupted classes and project access.\\n\\nAssigned Counselor: ${student.assignedTo?.fullName || 'Academic Support'}\\nHelpline: 7087015329 / 7087015340\\nWebsite: https://www.wipronix.com`;

        const whatsappReminderUrl = `https://api.whatsapp.com/send?phone=${formattedMobile}&text=${encodeURIComponent(reminderMsg)}`;

        dueAlerts.push({
          studentId: student._id,
          studentName: student.fullName,
          email: student.email,
          phoneNumber: student.phoneNumber,
          college: student.college,
          technology: student.registeredTechnology || student.technology,
          totalFee: student.totalFee,
          totalPaidFee: student.totalPaidFee,
          remainingFee,
          dueDate: student.nextDueDate,
          diffDays,
          status,
          alertLabel,
          assignedCounselor: student.assignedTo?.fullName || 'Not Assigned',
          whatsappReminderUrl
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        totalDueAlerts: dueAlerts.length,
        alerts: dueAlerts
      }
    });
  } catch (error) {
    console.error('Error fetching due alerts:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// =============================================================================
// REGISTRATION & PAYMENT VERIFICATION DELEGATIONS
// =============================================================================
const financeController = require('../Finance/financeController');

exports.getAllRegistrationSlips = financeController.getAllRegistrationSlips;
exports.verifyPaymentProof = financeController.verifyRegistrationSlip;

exports.getRegistrationSlipsForStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const slips = await RegistrationSlip.find({ student: studentId })
      .populate('issuedBy', 'fullName firstName lastName email role')
      .populate('verifiedBy', 'fullName firstName lastName email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: slips
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRegistrationPaymentLink = async (req, res) => {
  return exports.generateRegistrationSlip(req, res);
};


// =============================================================================
// SUPERADMIN: UPDATE REGISTRATION SLIP & CANDIDATE DETAILS
// =============================================================================
exports.updateRegistrationSlip = async (req, res) => {
  try {
    const staff = req.staff || req.user;
    if (!staff) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const staffRole = (staff.role || staff.systemRole || '').toLowerCase();
    const isSuperAdminOrAdmin = ['superadmin', 'super_admin', 'admin', 'director'].includes(staffRole);
    if (!isSuperAdminOrAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Superadmin or Finance Admin can edit registration slips and student records.'
      });
    }

    const { slipId } = req.params;
    const {
      studentName,
      phoneNumber,
      email,
      college,
      technology,
      duration,
      totalFee,
      discountAmount,
      discountType,
      paidAmount,
      paymentMode,
      transactionId,
      paymentScreenshotUrl,
      paymentScreenshots,
      nextDueDate,
      remarks,
      fatherName,
      address,
      assignedTo
    } = req.body;

    const slip = await RegistrationSlip.findById(slipId).populate('student');
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Registration slip not found.' });
    }

    // 1. Update candidate info in slip
    if (studentName) slip.studentName = studentName.trim();
    if (phoneNumber) slip.phoneNumber = phoneNumber.trim();
    if (email) slip.email = email.trim().toLowerCase();
    if (college) slip.college = college.trim();
    if (technology) {
      slip.technology = technology.trim();
      slip.registeredTechnology = technology.trim();
      await ensureRegistrationCourseExists(technology.trim(), staff._id);
    }
    if (duration) slip.duration = duration.trim();
    if (fatherName !== undefined) slip.fatherName = fatherName.trim();
    if (address !== undefined) slip.address = address.trim();

    // 2. Update payment details
    if (paymentMode) {
      slip.paymentMode = paymentMode;
      const isCash = paymentMode.toLowerCase().includes('cash');
      slip.mode = isCash ? 'In-Office' : 'Remote-QR';
      if (isCash && !transactionId) {
        slip.transactionId = 'CASH-PAYMENT';
      }
    }
    if (transactionId !== undefined) {
      slip.transactionId = transactionId.trim();
    }
    const incomingScreenshots = (paymentScreenshots !== undefined && Array.isArray(paymentScreenshots))
      ? paymentScreenshots
      : (paymentScreenshotUrl !== undefined ? (paymentScreenshotUrl ? [paymentScreenshotUrl] : []) : undefined);

    if (incomingScreenshots !== undefined) {
      const cloudinaryUrls = await uploadProofScreenshotsToCloudinary(incomingScreenshots);
      slip.paymentScreenshots = cloudinaryUrls;
      slip.paymentScreenshotUrl = cloudinaryUrls[0] || '';
      slip.studentSubmissionDate = new Date();
    }
    if (nextDueDate !== undefined) {
      slip.nextDueDate = nextDueDate ? new Date(nextDueDate) : null;
    }
    if (remarks !== undefined) {
      slip.remarks = remarks.trim();
    }

    // 3. Update financial figures
    if (totalFee !== undefined && totalFee !== null) slip.totalFee = Number(totalFee);
    if (discountAmount !== undefined && discountAmount !== null) slip.discountAmount = Number(discountAmount);
    if (discountType !== undefined) slip.discountType = (discountType || '').trim();
    if (paidAmount !== undefined && paidAmount !== null) slip.paidAmount = Number(paidAmount);

    const netFee = (slip.totalFee || 25000) - (slip.discountAmount || 0);

    // Calculate dueAmount based on all verified slips for this student
    const student = slip.student ? await Student.findById(slip.student._id) : null;
    if (student) {
      if (studentName) student.fullName = studentName.trim();
      if (phoneNumber) student.phoneNumber = phoneNumber.trim();
      if (email) student.email = email.trim().toLowerCase();
      if (college) student.college = college.trim();
      if (technology) {
        student.registeredTechnology = technology.trim();
        student.admissionTechnology = technology.trim();
        student.technology = technology.trim();
      }
      if (duration) student.trainingDuration = duration.trim();
      if (fatherName !== undefined) student.fatherName = fatherName.trim();
      if (address !== undefined) student.address = address.trim();
      if (assignedTo) {
        student.assignedTo = assignedTo;
        student.assignedBy = staff._id;
        student.assignedAt = new Date();
      }

      if (slip.totalFee !== undefined) student.totalFee = Number(slip.totalFee);
      if (slip.discountAmount !== undefined) student.discountAmount = Number(slip.discountAmount);
      if (slip.discountType !== undefined) student.discountType = slip.discountType;

      // Calculate total paid across all verified slips
      const otherVerifiedSlips = await RegistrationSlip.find({
        student: student._id,
        _id: { $ne: slip._id },
        status: { $in: ['Verified', 'Paid'] }
      });
      const otherPaid = otherVerifiedSlips.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
      const totalPaidSoFar = otherPaid + (Number(slip.paidAmount) || 0);

      const calculatedRemaining = Math.max(0, netFee - totalPaidSoFar);
      slip.dueAmount = calculatedRemaining;

      student.totalPaidFee = totalPaidSoFar;
      student.admissionFee = totalPaidSoFar;
      student.registrationFee = totalPaidSoFar;
      student.dueAmount = calculatedRemaining;
      student.netRemainingFee = calculatedRemaining;
      student.pendingFee = calculatedRemaining;
      if (slip.nextDueDate) student.nextDueDate = slip.nextDueDate;

      await student.save();
    } else {
      slip.dueAmount = Math.max(0, netFee - (Number(slip.paidAmount) || 0));
    }

    await slip.save();

    // 4. Regenerate PDF receipt if slip is verified
    if (slip.status === 'Verified' || slip.status === 'Paid') {
      try {
        const receiptService = require('../../src/services/receiptService');
        await receiptService.generateAndSaveReceipt(slip, student || {});
      } catch (pdfErr) {
        console.warn('PDF re-generation warning:', pdfErr.message);
      }
    }

    // Populate for response
    const populated = await RegistrationSlip.findById(slip._id)
      .populate('student', 'fullName email phoneNumber college course semester')
      .populate('issuedBy', 'fullName firstName lastName email role')
      .populate('verifiedBy', 'fullName firstName lastName email role');

    return res.status(200).json({
      success: true,
      message: 'Registration slip and candidate details updated successfully',
      data: populated
    });
  } catch (error) {
    console.error('Error updating registration slip:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update registration slip',
      error: error.message
    });
  }
};


// =============================================================================
// DYNAMIC REGISTRATION COURSES (DOCUMENT COLLECTION)
// =============================================================================
exports.getRegistrationCourses = async (req, res) => {
  try {
    let courses = await RegistrationCourse.find({ isActive: { $ne: false } }).sort({ createdAt: 1 }).lean();
    if (!courses || courses.length === 0) {
      const docs = DEFAULT_REGISTRATION_COURSES.map(name => ({
        name,
        isActive: true,
        isCustom: false
      }));
      await RegistrationCourse.insertMany(docs, { ordered: false }).catch(() => {});
      courses = await RegistrationCourse.find({ isActive: { $ne: false } }).sort({ createdAt: 1 }).lean();
    }

    // Ensure 'AI / ML' is present
    const hasAiMl = courses.some(c => c.name.toLowerCase().replace(/\s+/g, '') === 'ai/ml');
    if (!hasAiMl) {
      await RegistrationCourse.create({
        name: 'AI / ML',
        isActive: true,
        isCustom: false
      }).catch(() => {});
      courses = await RegistrationCourse.find({ isActive: { $ne: false } }).sort({ createdAt: 1 }).lean();
    }

    return res.status(200).json({
      success: true,
      data: courses.map(c => c.name)
    });
  } catch (error) {
    console.error('Error fetching registration courses:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.addRegistrationCourse = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Course track name is required' });
    }
    const cleanName = name.trim();
    let course = await RegistrationCourse.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') }
    });
    if (!course) {
      course = await RegistrationCourse.create({
        name: cleanName,
        isActive: true,
        isCustom: true,
        createdBy: req.staff?._id || req.user?._id
      });
    }
    return res.status(200).json({
      success: true,
      data: course.name,
      message: `Course track "${course.name}" registered successfully.`
    });
  } catch (error) {
    console.error('Error adding registration course:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upload single or multiple payment proofs to Cloudinary
 */
exports.uploadProofToCloudinary = async (req, res) => {
  try {
    const { image, images } = req.body;
    const toUpload = images && Array.isArray(images) ? images : (image ? [image] : []);
    if (toUpload.length === 0) {
      return res.status(400).json({ success: false, message: 'No image provided for upload.' });
    }
    const uploadedUrls = await uploadProofScreenshotsToCloudinary(toUpload);
    return res.status(200).json({
      success: true,
      url: uploadedUrls[0] || '',
      urls: uploadedUrls,
      message: 'Payment proof uploaded to Cloudinary successfully.'
    });
  } catch (err) {
    console.error('Error uploading to Cloudinary:', err);
    return res.status(500).json({ success: false, message: 'Failed to upload proof to Cloudinary', error: err.message });
  }
};

/**
 * Migrate all existing slips in database with base64 screenshots to Cloudinary
 */
exports.migrateAllProofsToCloudinary = async (req, res) => {
  try {
    const slips = await RegistrationSlip.find({
      $or: [
        { paymentScreenshotUrl: { $regex: '^data:image' } },
        { paymentScreenshots: { $elemMatch: { $regex: '^data:image' } } }
      ]
    });

    let migratedSlipsCount = 0;
    let migratedImagesCount = 0;

    for (const slip of slips) {
      const currentList = (slip.paymentScreenshots && slip.paymentScreenshots.length > 0)
        ? slip.paymentScreenshots
        : (slip.paymentScreenshotUrl ? [slip.paymentScreenshotUrl] : []);

      const hasBase64 = currentList.some(item => typeof item === 'string' && item.startsWith('data:image'));
      if (hasBase64) {
        const cloudinaryUrls = await uploadProofScreenshotsToCloudinary(currentList);
        slip.paymentScreenshots = cloudinaryUrls;
        slip.paymentScreenshotUrl = cloudinaryUrls[0] || '';
        await slip.save();
        migratedSlipsCount++;
        migratedImagesCount += cloudinaryUrls.length;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Migrated ${migratedImagesCount} proofs across ${migratedSlipsCount} slips to Cloudinary.`,
      migratedSlipsCount,
      migratedImagesCount
    });
  } catch (err) {
    console.error('Error migrating proofs to Cloudinary:', err);
    return res.status(500).json({ success: false, message: 'Migration failed', error: err.message });
  }
};

// Automatic background migration on server startup with internet access
setTimeout(async () => {
  try {
    const count = await RegistrationSlip.countDocuments({
      $or: [
        { paymentScreenshotUrl: { $regex: '^data:image' } },
        { paymentScreenshots: { $elemMatch: { $regex: '^data:image' } } }
      ]
    });
    if (count > 0) {
      console.log(`[Cloudinary Migration] Found ${count} slips with base64 payment proofs. Migrating to Cloudinary...`);
      const slips = await RegistrationSlip.find({
        $or: [
          { paymentScreenshotUrl: { $regex: '^data:image' } },
          { paymentScreenshots: { $elemMatch: { $regex: '^data:image' } } }
        ]
      });
      for (const slip of slips) {
        const currentList = (slip.paymentScreenshots && slip.paymentScreenshots.length > 0)
          ? slip.paymentScreenshots
          : (slip.paymentScreenshotUrl ? [slip.paymentScreenshotUrl] : []);
        const cloudinaryUrls = await uploadProofScreenshotsToCloudinary(currentList);
        slip.paymentScreenshots = cloudinaryUrls;
        slip.paymentScreenshotUrl = cloudinaryUrls[0] || '';
        await slip.save();
      }
      console.log(`[Cloudinary Migration] Finished migrating payment proofs to Cloudinary.`);
    }
  } catch (bgErr) {
    console.warn('[Cloudinary Migration] Background check:', bgErr.message);
  }
}, 5000);

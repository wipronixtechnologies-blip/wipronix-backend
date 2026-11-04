const Lead = require('../../models/Lead.model');
const Campaign = require('../../models/Campaign.model');
const DailyOutreach = require('../../models/DailyOutreach.model');
const Staff = require('../../models/Staff.model');

exports.getMarketingOverview = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [leads, campaigns, dailyOutreach] = await Promise.all([
      Lead.find().sort({ createdAt: -1 }),
      Campaign.find().sort({ createdAt: -1 }),
      DailyOutreach.findOne({ staff: req.staff._id, date: today })
    ]);

    const totalLeads = leads.length;
    const leadsContacted = leads.filter(l => l.status === 'Contacted').length;
    const leadsConverted = leads.filter(l => l.status === 'Converted').length;

    const todayLeads = leads.filter(l => new Date(l.createdAt) >= today).length;

    const conversionRate = totalLeads > 0 ? (leadsConverted / totalLeads) * 100 : 0;

    // Performance Metrics for current user
    const dailyOutreachContact = dailyOutreach || { calls: 0, messages: 0, emails: 0 };

    // BDE Breakdown for Admin
    let bdePerformance = [];
    const isAdmin = ['super_admin', 'admin'].includes(req.staff.role) || ['super_admin', 'admin'].includes(req.staff.systemRole);

    if (isAdmin) {
      const bdes = await Staff.find({
        $or: [{ role: { $in: ['bde', 'training_head'] } }, { systemRole: { $in: ['bde', 'training_head'] } }]
      }).select('fullName role systemRole');

      const bdeIds = bdes.map(b => b._id);

      // Get outreach for all BDEs for today
      const allOutreach = await DailyOutreach.find({
        staff: { $in: bdeIds },
        date: today
      });

      bdePerformance = bdes.map(bde => {
        const bdeLeads = leads.filter(l => l.assignedTo && l.assignedTo.toString() === bde._id.toString());
        const bdeContacted = bdeLeads.filter(l => l.status === 'Contacted').length;
        const bdeConverted = bdeLeads.filter(l => l.status === 'Converted').length;
        const bdeOutreach = allOutreach.find(o => o.staff.toString() === bde._id.toString()) || { calls: 0, messages: 0, emails: 0 };

        return {
          _id: bde._id,
          fullName: bde.fullName,
          role: bde.role || bde.systemRole,
          totalLeads: bdeLeads.length,
          contacted: bdeContacted,
          converted: bdeConverted,
          conversionRate: bdeLeads.length > 0 ? (bdeConverted / bdeLeads.length) * 100 : 0,
          outreach: bdeOutreach
        };
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalLeads,
        todayLeads,
        conversionRate,
        leadsContacted,
        leadsConverted,
        dailyOutreach: dailyOutreachContact,
        bdePerformance: isAdmin ? bdePerformance : undefined,
        campaigns: campaigns.map(c => ({
          _id: c._id,
          name: c.name,
          leads: c.leadsGenerated,
          spent: c.spent,
          budget: c.budget,
          conversion: c.conversions
        })),
        recentLeads: leads.slice(0, 10)
      }
    });

  } catch (error) {
    console.error('Error fetching marketing overview:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.addLead = async (req, res) => {
  try {
    const lead = new Lead({ ...req.body, assignedTo: req.staff._id });
    await lead.save();

    if (lead.campaign) {
      await Campaign.findByIdAndUpdate(lead.campaign, { $inc: { leadsGenerated: 1 } });
    }

    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateLeadStatus = async (req, res) => {
  try {
    const { status, assignedTo } = req.body;

    let updatePayload = { status };
    if (assignedTo !== undefined) {
      updatePayload.assignedTo = assignedTo;
    }

    const lead = await Lead.findByIdAndUpdate(req.params.id, updatePayload, { new: true });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.logDailyActivity = async (req, res) => {
  try {
    const { calls, messages, emails } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let outreach = await DailyOutreach.findOne({ staff: req.staff._id, date: today });

    if (outreach) {
      outreach.calls += calls || 0;
      outreach.messages += messages || 0;
      outreach.emails += emails || 0;
      await outreach.save();
    } else {
      outreach = new DailyOutreach({
        staff: req.staff._id,
        date: today,
        calls: calls || 0,
        messages: messages || 0,
        emails: emails || 0
      });
      await outreach.save();
    }

    res.status(200).json({ success: true, data: outreach });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find();
    res.status(200).json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

exports.createCampaign = async (req, res) => {
  try {
    const campaign = new Campaign(req.body);
    await campaign.save();
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}
exports.getLeads = async (req, res) => {
  try {
    const leads = await Lead.find().populate('assignedTo', 'fullName').populate('campaign', 'name');
    res.status(200).json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Superadmin & Admin only:
 * Aggregates all colleges across the entire students database,
 * computing total student count, assigned count, unassigned count,
 * admissions, sources, and assigned counselors per college.
 */
exports.getAllCollegesAnalytics = async (req, res) => {
  try {
    const role = (req.staff?.role || '').toLowerCase();
    const systemRole = (req.staff?.systemRole || '').toLowerCase();
    const isSuperAdminOrAdmin = ['super_admin', 'superadmin', 'admin'].includes(role) ||
                                ['super_admin', 'superadmin', 'admin'].includes(systemRole);

    if (!isSuperAdminOrAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Super Admin and Admin can view All Colleges Analytics.'
      });
    }

    const Student = require('../../models/Student.model');

    const includeOrganic = req.query.includeOrganic !== 'false' && req.query.includeOrganic !== false;
    const includeDrive = req.query.includeDrive !== 'false' && req.query.includeDrive !== false;
    const includeExcel = req.query.includeExcel !== 'false' && req.query.includeExcel !== false;

    const organicSources = ['organic', 'Organic', 'website', 'web'];
    const excelSources = ['excel', 'Excel', 'import', 'Import', 'college_leads', 'bulk_import'];

    const allowedConditions = [];
    if (includeOrganic) {
      allowedConditions.push({ source: { $in: organicSources } });
    }
    if (includeExcel) {
      allowedConditions.push({ source: { $in: excelSources } });
    }
    if (includeDrive) {
      allowedConditions.push({ source: { $nin: [...organicSources, ...excelSources] } });
    }

    if (allowedConditions.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          totalColleges: 0,
          totalStudents: 0,
          totalAssigned: 0,
          totalUnassigned: 0,
          totalAdmissions: 0,
          assignmentRate: 0
        },
        data: []
      });
    }

    const matchStage = {
      college: { $exists: true, $ne: null, $nin: ['', ' '] }
    };
    if (allowedConditions.length < 3) {
      matchStage.$or = allowedConditions;
    }

    const collegesAgg = await Student.aggregate([
      {
        $match: matchStage
      },
      {
        $group: {
          _id: { $trim: { input: '$college' } },
          totalStudents: { $sum: 1 },
          assignedCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$assignedTo', null] },
                    { $ne: ['$assignedTo', ''] },
                    { $ne: ['$assignedTo', false] }
                  ]
                },
                1,
                0
              ]
            }
          },
          unassignedCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$assignedTo', null] },
                    { $eq: ['$assignedTo', ''] },
                    { $eq: ['$assignedTo', false] }
                  ]
                },
                1,
                0
              ]
            }
          },
          admissionsCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ['$leadStage', ['Admission done', 'Enrolled', 'enrolled', 'Admission Done', 'Admitted']] },
                    { $in: ['$counselingStatus', ['enrolled', 'admission_done', 'Admitted', 'Admission Done']] }
                  ]
                },
                1,
                0
              ]
            }
          },
          organicCount: {
            $sum: {
              $cond: [
                { $in: ['$source', organicSources] },
                1,
                0
              ]
            }
          },
          placementDriveCount: {
            $sum: {
              $cond: [
                {
                  $not: {
                    $in: ['$source', [...organicSources, ...excelSources]]
                  }
                },
                1,
                0
              ]
            }
          },
          excelCount: {
            $sum: {
              $cond: [
                { $in: ['$source', excelSources] },
                1,
                0
              ]
            }
          },
          assignedCounselorIds: {
            $addToSet: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$assignedTo', null] },
                    { $ne: ['$assignedTo', ''] },
                    { $ne: ['$assignedTo', false] }
                  ]
                },
                '$assignedTo',
                null
              ]
            }
          },
          latestStudentDate: { $max: '$createdAt' }
        }
      },
      {
        $sort: { totalStudents: -1 }
      }
    ]);

    // Collect counselor names in bulk
    const allCounselorIds = new Set();
    collegesAgg.forEach(c => {
      if (Array.isArray(c.assignedCounselorIds)) {
        c.assignedCounselorIds.forEach(id => {
          if (id) allCounselorIds.add(id.toString());
        });
      }
    });

    const staffDocs = await Staff.find({ _id: { $in: Array.from(allCounselorIds) } })
      .select('fullName role systemRole email')
      .lean();
    const staffMap = {};
    staffDocs.forEach(s => {
      staffMap[s._id.toString()] = s.fullName || s.email;
    });

    let overallTotalStudents = 0;
    let overallAssigned = 0;
    let overallUnassigned = 0;
    let overallAdmissions = 0;

    const formattedColleges = collegesAgg.map(c => {
      overallTotalStudents += c.totalStudents;
      overallAssigned += c.assignedCount;
      overallUnassigned += c.unassignedCount;
      overallAdmissions += c.admissionsCount;

      const counselorNames = (c.assignedCounselorIds || [])
        .filter(Boolean)
        .map(id => staffMap[id.toString()])
        .filter(Boolean);

      return {
        collegeName: c._id,
        totalStudents: c.totalStudents,
        assignedCount: c.assignedCount,
        unassignedCount: c.unassignedCount,
        assignedPercentage: c.totalStudents > 0 ? Math.round((c.assignedCount / c.totalStudents) * 100) : 0,
        admissionsCount: c.admissionsCount,
        organicCount: c.organicCount || 0,
        placementDriveCount: c.placementDriveCount || 0,
        excelCount: c.excelCount || 0,
        assignedCounselors: counselorNames,
        latestStudentDate: c.latestStudentDate
      };
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalColleges: formattedColleges.length,
        totalStudents: overallTotalStudents,
        totalAssigned: overallAssigned,
        totalUnassigned: overallUnassigned,
        totalAdmissions: overallAdmissions,
        assignmentRate: overallTotalStudents > 0 ? Math.round((overallAssigned / overallTotalStudents) * 100) : 0
      },
      data: formattedColleges
    });
  } catch (error) {
    console.error('Error in getAllCollegesAnalytics:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching college analytics' });
  }
};

/**
 * Superadmin & Admin only:
 * Returns full history and details of students belonging to a specific college,
 * including assignment information, counseling history, and lead stages.
 */
exports.getCollegeStudentsHistory = async (req, res) => {
  try {
    const role = (req.staff?.role || '').toLowerCase();
    const systemRole = (req.staff?.systemRole || '').toLowerCase();
    const isSuperAdminOrAdmin = ['super_admin', 'superadmin', 'admin'].includes(role) ||
                                ['super_admin', 'superadmin', 'admin'].includes(systemRole);

    if (!isSuperAdminOrAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Super Admin and Admin can view College Student History.'
      });
    }

    const Student = require('../../models/Student.model');
    const { college, search, assignmentFilter, page = 1, limit = 50 } = req.query;

    if (!college) {
      return res.status(400).json({ success: false, message: 'College name is required' });
    }

    const includeOrganic = req.query.includeOrganic !== 'false' && req.query.includeOrganic !== false;
    const includeDrive = req.query.includeDrive !== 'false' && req.query.includeDrive !== false;
    const includeExcel = req.query.includeExcel !== 'false' && req.query.includeExcel !== false;

    const organicSources = ['organic', 'Organic', 'website', 'web'];
    const excelSources = ['excel', 'Excel', 'import', 'Import', 'college_leads', 'bulk_import'];

    const sourceConditions = [];
    if (includeOrganic) {
      sourceConditions.push({ source: { $in: organicSources } });
    }
    if (includeExcel) {
      sourceConditions.push({ source: { $in: excelSources } });
    }
    if (includeDrive) {
      sourceConditions.push({ source: { $nin: [...organicSources, ...excelSources] } });
    }

    const andConditions = [
      { college: { $regex: new RegExp(`^${escapeRegex(college.trim())}$`, 'i') } }
    ];

    if (sourceConditions.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    }

    if (sourceConditions.length < 3) {
      andConditions.push({ $or: sourceConditions });
    }

    if (assignmentFilter === 'assigned') {
      andConditions.push({ assignedTo: { $ne: null, $exists: true, $nin: ['', false] } });
    } else if (assignmentFilter === 'unassigned') {
      andConditions.push({
        $or: [
          { assignedTo: null },
          { assignedTo: { $exists: false } },
          { assignedTo: '' },
          { assignedTo: false }
        ]
      });
    }

    if (search && search.trim()) {
      const sRegex = new RegExp(escapeRegex(search.trim()), 'i');
      andConditions.push({
        $or: [
          { fullName: sRegex },
          { email: sRegex },
          { phoneNumber: sRegex },
          { course: sRegex },
          { technology: sRegex },
          { registeredTechnology: sRegex },
          { admissionTechnology: sRegex },
          { leadStage: sRegex }
        ]
      });
    }

    const filter = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate('assignedTo', 'fullName email role systemRole designation')
        .populate('assignedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      Student.countDocuments(filter)
    ]);

    const formattedStudents = students.map(st => {
      const latestCall = Array.isArray(st.callLogs) && st.callLogs.length > 0
        ? st.callLogs[st.callLogs.length - 1]
        : null;

      return {
        _id: st._id,
        fullName: st.fullName,
        email: st.email,
        phoneNumber: st.phoneNumber,
        course: st.course,
        technology: st.registeredTechnology || st.admissionTechnology || st.technology || 'N/A',
        semester: st.semester,
        city: st.city,
        source: st.source,
        assignedTo: st.assignedTo ? {
          _id: st.assignedTo._id,
          fullName: st.assignedTo.fullName || st.assignedTo.email,
          role: st.assignedTo.role || st.assignedTo.systemRole || 'Staff'
        } : null,
        assignedAt: st.assignedAt,
        assignedBy: st.assignedBy ? {
          _id: st.assignedBy._id,
          fullName: st.assignedBy.fullName
        } : null,
        leadStage: st.leadStage || 'New Lead',
        leadSubStage: st.leadSubStage || '',
        counselingStatus: st.counselingStatus || '',
        totalFee: st.totalFee || 0,
        totalPaidFee: st.totalPaidFee || 0,
        dueAmount: st.dueAmount || 0,
        callCount: (st.callLogs || []).length,
        lastContactedAt: latestCall ? latestCall.calledAt : st.lastContactedAt,
        lastOutcome: latestCall ? latestCall.callOutcome : null,
        lastNotes: latestCall ? latestCall.notes : st.counselingNotes,
        createdAt: st.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      college,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / take),
      data: formattedStudents
    });

  } catch (error) {
    console.error('Error fetching college student history:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching student history' });
  }
};

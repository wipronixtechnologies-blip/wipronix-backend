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
    const { status } = req.body;
    const lead = await Lead.findByIdAndUpdate(req.params.id, { status }, { new: true });
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
}

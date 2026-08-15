const Proposal = require('../../models/Proposal.model');
const CommunicationLog = require('../../models/CommunicationLog.model');

exports.getBidderDashboard = async (req, res) => {
  try {
    const proposals = await Proposal.find().sort({ createdAt: -1 });
    
    // Revenue Tracker
    const totalExpectedValue = proposals
        .filter(p => p.status === 'Won')
        .reduce((sum, p) => sum + (p.closedValue || 0), 0);
    
    // Status Counts
    const statusCounts = proposals.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: totalExpectedValue,
        statusCounts: {
            Draft: statusCounts.Draft || 0,
            Submitted: statusCounts.Submitted || 0,
            Negotiation: statusCounts.Negotiation || 0,
            Won: statusCounts.Won || 0,
            Lost: statusCounts.Lost || 0
        },
        recentProposals: proposals.slice(0, 5)
      }
    });

  } catch (error) {
    console.error('Error fetching bidder dashboard:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getProposals = async (req, res) => {
    try {
        const proposals = await Proposal.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: proposals });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createProposal = async (req, res) => {
    try {
        const proposal = new Proposal({ ...req.body, assignedTo: req.staff._id });
        await proposal.save();
        res.status(201).json({ success: true, data: proposal });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateProposalStatus = async (req, res) => {
    try {
        const { status, closedValue } = req.body;
        const updateData = { status };
        
        if (status === 'Won' && closedValue) {
            updateData.closedValue = closedValue;
        }

        const proposal = await Proposal.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });
        
        res.status(200).json({ success: true, data: proposal });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateHandover = async (req, res) => {
    try {
        const proposal = await Proposal.findByIdAndUpdate(req.params.id, { handover: req.body }, { new: true });
        if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });
        
        res.status(200).json({ success: true, data: proposal });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.addCommunicationLog = async (req, res) => {
    try {
        const log = new CommunicationLog({ ...req.body, proposal: req.params.id, loggedBy: req.staff._id });
        await log.save();
        res.status(201).json({ success: true, data: log });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getCommunicationLogs = async (req, res) => {
    try {
        const logs = await CommunicationLog.find({ proposal: req.params.id }).sort({ createdAt: -1 }).populate('loggedBy', 'fullName');
        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

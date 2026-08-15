const Staff = require('../../models/Staff.model');
const Student = require('../../models/Student.model');
const College = require('../../models/College.model');
const Lead = require('../../models/Lead.model');
const Campaign = require('../../models/Campaign.model');
const Proposal = require('../../models/Proposal.model');
const FeePayment = require('../../models/FeePayment.model');
const PlacementDrive = require('../../models/PlacementDrive.model');

// Super Admin & Admin Dashboard Stats
exports.getOrganizationOverview = async (req, res) => {
    try {
        // --- Organization Snapshot ---
        const [
            totalStaff, 
            activeDepartments,
            totalStudents,
            totalColleges
        ] = await Promise.all([
            Staff.countDocuments({ isActive: true }),
            Staff.distinct('department'),
            Student.countDocuments(),
            College.countDocuments()
        ]);

        // Monthly Revenue (Fee Payments + Closed Proposals)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0,0,0,0);

        const [monthlyFees, monthlyClosedProposals] = await Promise.all([
            FeePayment.find({ date: { $gte: startOfMonth }, status: 'Paid' }),
            Proposal.find({ updatedAt: { $gte: startOfMonth }, status: 'Won' })
        ]);

        const feeRevenue = monthlyFees.reduce((sum, f) => sum + f.amount, 0);
        const projectRevenue = monthlyClosedProposals.reduce((sum, p) => sum + (p.closedValue || 0), 0);
        const monthlyRevenue = feeRevenue + projectRevenue;

        // Growth Simulation (To be replaced with real historical comparison)
        const growthPercentage = 5.2; // Placeholder

        // --- Department Performance ---
        // Marketing: ROI (Needs cost vs revenue, simple leads count for now)
        const totalLeads = await Lead.countDocuments();
        const convertedLeads = await Lead.countDocuments({ status: 'Converted' });
        const marketingROI = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

        // Bidding: Win Ratio
        const totalBids = await Proposal.countDocuments();
        const wonBids = await Proposal.countDocuments({ status: 'Won' });
        const bidWinRatio = totalBids > 0 ? (wonBids / totalBids) * 100 : 0;

        // Placement: Success % (Selected / Total Candidates in Drives)
        // Harder to aggregate without lookup, approximation:
        const drives = await PlacementDrive.find().populate('candidates');
        let totalCandidates = 0;
        let selectedCandidates = 0;
        drives.forEach(d => {
            if (d.candidates) {
                totalCandidates += d.candidates.length;
                d.candidates.forEach(c => {
                    if (c.status === 'Selected') selectedCandidates++;
                });
            }
        });
        const placementSuccess = totalCandidates > 0 ? (selectedCandidates / totalCandidates) * 100 : 0;


        // --- Revenue Intelligence ---
        // Fees by type
        const feeDistribution = await FeePayment.aggregate([
            { $match: { status: 'Paid' } },
            { $group: { _id: '$type', total: { $sum: '$amount' } } }
        ]);

        // --- Lead Funnel ---
        const leadFunnel = {
            leads: totalLeads,
            enrolled: totalStudents, // Assuming enrollment comes from leads
            placed: selectedCandidates
        };
        
        // --- Alerts & Risks ---
        const alerts = [];
        if (bidWinRatio < 10) alerts.push({ type: 'risk', message: 'Bid Win Ratio below 10%', severity: 'high' });
        if (marketingROI < 2) alerts.push({ type: 'risk', message: 'Marketing Conversion low', severity: 'medium' });

        res.status(200).json({
            success: true,
            data: {
                snapshot: {
                    totalStaff,
                    activeDepartments: activeDepartments.length,
                    totalStudents,
                    totalColleges,
                    monthlyRevenue,
                    growthPercentage
                },
                performance: {
                    marketingROI,
                    bidWinRatio,
                    placementSuccess,
                    admissionsRevenue: feeRevenue
                },
                revenue: {
                    feeDistribution,
                    projectRevenue
                },
                funnel: leadFunnel,
                alerts
            }
        });

    } catch (error) {
        console.error('Error fetching org overview:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Pending Approvals & Decision Controls
exports.getPendingApprovals = async (req, res) => {
    try {
        const [
            pendingCampaigns,
            highValueBids,
            pendingHires,
            riskyProposals
        ] = await Promise.all([
            // Campaign Budget Approvals
            Campaign.find({ status: 'Pending' }),
            
            // High Value Bids (> 500000) that are submitted
            Proposal.find({ status: { $in: ['Submitted', 'Negotiation'] }, quotedAmount: { $gt: 500000 } }),
            
            // Pending Staff Approvals (Inactive)
            Staff.find({ isActive: false }).select('fullName email department designation'),

            // Risky Proposals (Low value or long negotiation, placeholder logic)
            Proposal.find({ status: 'Negotiation', updatedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }) // > 30 days old
        ]);

        res.status(200).json({
            success: true,
            data: {
                campaigns: pendingCampaigns,
                bids: highValueBids,
                hires: pendingHires,
                risks: riskyProposals
            }
        });

    } catch (error) {
        console.error('Error fetching pending approvals:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Generic Approval Action (optional, but services can handle their own updates)
// We will let frontend call specific update endpoints for better separation of concerns, 
// OR we can expose specific admin actions here if needed.
// For now, getPendingApprovals is sufficient for the dashboard to render the modals.

const College = require('../../models/College.model');
const PlacementProposal = require('../../models/PlacementProposal.model');
const PlacementDrive = require('../../models/PlacementDrive.model');
const DriveCandidate = require('../../models/DriveCandidate.model');
const Staff = require('../../models/Staff.model');
const Goal = require('../../models/Goal.model');
const DailyOutreach = require('../../models/DailyOutreach.model');

// Import utilities and services at the top
const { generateProposalPDF } = require('./generateProposalPDF');
const { sendProposalEmail: sendProposalEmailService } = require('../../src/services/emailService');

// --- Training Head / BDE Specific Features ---

// Assign Data (College) to BDE
exports.assignCollege = async (req, res) => {
    try {
        const { collegeId, staffId } = req.body;
        const college = await College.findByIdAndUpdate(
            collegeId, 
            { assignedTo: staffId, updatedBy: req.staff._id }, 
            { new: true }
        ).populate('assignedTo', 'fullName email');
        
        if (!college) return res.status(404).json({ success: false, message: 'College not found' });
        
        res.status(200).json({ success: true, data: college, message: 'College assigned successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Get My Assigned Colleges (for BDE/Training Head self)
exports.getMyColleges = async (req, res) => {
    try {
        const colleges = await College.find({ assignedTo: req.staff._id });
        res.status(200).json({ success: true, data: colleges });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get BDE Staff (for Training Head to select)
exports.getBDEs = async (req, res) => {
    try {
        const bdes = await Staff.find({ role: { $in: ['bde', 'training_head', 'marketing_manager'] }, isActive: true }).select('fullName email role');
        res.status(200).json({ success: true, data: bdes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });   
    }
};

// --- Targets / Goals ---

exports.createGoal = async (req, res) => {
    try {
        const goal = new Goal({
            ...req.body,
            assignedBy: req.staff._id,
            assignedByName: req.staff.fullName
        });
        await goal.save();
        res.status(201).json({ success: true, data: goal });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getGoals = async (req, res) => {
    try {
        let query = {};
        if (req.staff.role === 'training_head' || req.staff.role === 'super_admin' || req.staff.role === 'marketing_manager') {
             if (req.query.employeeId) query.employee = req.query.employeeId;
        } else {
             query.employee = req.staff._id;
        }

        const goals = await Goal.find(query).populate('employee', 'fullName').sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: goals });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateGoal = async (req, res) => {
    try {
        const goal = await Goal.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ success: true, data: goal });
    } catch (error) {
         res.status(400).json({ success: false, message: error.message });
    }
};


// --- Daily Reporting ---

exports.submitDailyReport = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date();
        endOfDay.setHours(23,59,59,999);

        let report = await DailyOutreach.findOne({ 
            staff: req.staff._id, 
            date: { $gte: startOfDay, $lte: endOfDay } 
        });

        if (report) {
            report = await DailyOutreach.findByIdAndUpdate(report._id, req.body, { new: true });
        } else {
            report = new DailyOutreach({
                ...req.body,
                staff: req.staff._id,
                date: new Date()
            });
            await report.save();
        }
        res.status(200).json({ success: true, data: report });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getDailyReports = async (req, res) => {
    try {
        let query = {};
        if (req.staff.role === 'training_head' || req.staff.role === 'super_admin' || req.staff.role === 'marketing_manager') {
            if (req.query.staffId) query.staff = req.query.staffId;
        } else {
            query.staff = req.staff._id;
        }
        
        if (req.query.date) {
            const startOfDay = new Date(req.query.date);
            startOfDay.setHours(0,0,0,0);
            const endOfDay = new Date(req.query.date);
            endOfDay.setHours(23,59,59,999);
            query.date = { $gte: startOfDay, $lte: endOfDay };
        }

        const reports = await DailyOutreach.find(query).populate('staff', 'fullName').sort({ date: -1 });
        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// TPO Database
exports.addCollege = async (req, res) => {
    try {
        const college = new College({ ...req.body, createdBy: req.staff._id });
        await college.save();
        res.status(201).json({ success: true, data: college });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getColleges = async (req, res) => {
    try {
        const colleges = await College.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: colleges });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Proposal Management
exports.createProposal = async (req, res) => {
    try {
        const proposal = new PlacementProposal({ ...req.body, createdBy: req.staff._id });
        await proposal.save();
        res.status(201).json({ success: true, data: proposal });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getProposals = async (req, res) => {
    try {
        const proposals = await PlacementProposal.find().sort({ createdAt: -1 }).populate('college', 'name location poc');
        res.status(200).json({ success: true, data: proposals });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addFollowUp = async (req, res) => {
    try {
        const proposal = await PlacementProposal.findById(req.params.id);
        if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });
        
        proposal.followUp.push({
            date: new Date(),
            ...req.body,
            loggedBy: req.staff._id
        });
        await proposal.save();
        res.status(200).json({ success: true, data: proposal });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// New Proposal Actions
exports.sendProposalEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const proposal = await PlacementProposal.findById(id).populate('college').populate('createdBy');
        
        if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });
        if (!proposal.college?.poc?.email) return res.status(400).json({ success: false, message: 'College POC email not found' });

        const pdfBuffer = await generateProposalPDF(id);
        const emailResult = await sendProposalEmailService(proposal, pdfBuffer);

        if (emailResult.success) {
            proposal.status = 'Sent';
            await proposal.save();
            res.status(200).json({ success: true, message: 'Proposal email sent successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send email', error: emailResult.error });
        }
    } catch (error) {
        console.error('Error in sendProposalEmail:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.previewProposalPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const pdfBuffer = await generateProposalPDF(id);
        const proposal = await PlacementProposal.findById(id);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Proposal_${(proposal?.title || 'proposal').replace(/\s+/g, '_')}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in previewProposalPDF:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Drive Scheduling
exports.scheduleDrive = async (req, res) => {
    try {
        const drive = new PlacementDrive(req.body);
        await drive.save();
        res.status(201).json({ success: true, data: drive });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getDrives = async (req, res) => {
    try {
        const drives = await PlacementDrive.find().sort({ driveDate: 1 }).populate('college', 'name');
        res.status(200).json({ success: true, data: drives });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Student Submission & Results
exports.addCandidate = async (req, res) => {
    try {
        const candidate = new DriveCandidate(req.body);
        await candidate.save();
        await PlacementDrive.findByIdAndUpdate(candidate.drive, { $push: { candidates: candidate._id } });
        res.status(201).json({ success: true, data: candidate });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.bulkUploadCandidates = async (req, res) => {
    try {
        const { candidates, driveId } = req.body;
        const createdCandidates = [];
        for (const c of candidates) {
            try {
                const newCandidate = new DriveCandidate({ ...c, drive: driveId });
                await newCandidate.save();
                createdCandidates.push(newCandidate);
                await PlacementDrive.findByIdAndUpdate(driveId, { $push: { candidates: newCandidate._id } });
            } catch (err) {
                console.error('Error adding individual candidate in bulk:', err.message);
            }
        }
        res.status(201).json({ success: true, count: createdCandidates.length, message: 'Candidates uploaded' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCandidates = async (req, res) => {
    try {
        const candidates = await DriveCandidate.find({ drive: req.params.driveId });
        res.status(200).json({ success: true, data: candidates });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateCandidateStatus = async (req, res) => {
    try {
        const candidate = await DriveCandidate.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
        res.status(200).json({ success: true, data: candidate });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

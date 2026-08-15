const Resignation = require('../../models/Resignation.model');
const Staff = require('../../models/Staff.model');
const multer = require('multer');
const documentService = require('../../src/services/documentService');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Helper to calculate days between two dates
const getDaysDiff = (date1, date2) => {
  const diffTime = Math.abs(date2 - date1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper to determine notice period based on employee type
const getNoticePeriodDays = (employeeType) => {
  switch (employeeType) {
    case 'full_time':
      return 30; // 1 month
    case 'part_time':
      return 15;
    case 'contract':
      return 15;
    case 'intern':
      return 7;
    default:
      return 30;
  }
};

exports.createResignation = async (req, res) => {
    try {
        const { reason, otherReason, preferredLastWorkingDay, attachment } = req.body;
        const staffId = req.staff.id;

        const staff = await Staff.findById(staffId);
        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }

        // Calculate expected dates
        const noticePeriodDays = getNoticePeriodDays(staff.employeeType);
        const today = new Date();
        const expectedLastWorkingDay = new Date(today);
        expectedLastWorkingDay.setDate(today.getDate() + noticePeriodDays);

        const preferredDate = new Date(preferredLastWorkingDay);
        
        let shortfallDays = 0;
        if (preferredDate < expectedLastWorkingDay) {
            shortfallDays = getDaysDiff(expectedLastWorkingDay, preferredDate);
        }

        // Determine initial stage
        let workflowStage = 'Manager Review';
        if (staff.role === 'hr' || staff.role === 'admin') {
            workflowStage = 'Final Approval'; // Direct supervision by Super Admin
        }

        const resignation = new Resignation({
            staff: staffId,
            reason,
            otherReason: reason === 'Other' ? otherReason : undefined,
            preferredLastWorkingDay: preferredDate,
            noticePeriodDays,
            expectedLastWorkingDay,
            shortfallDays,
            attachment,
            status: 'Pending',
            workflowStage
        });

        await resignation.save();

        res.status(201).json({
            success: true,
            data: resignation,
            message: 'Resignation request submitted successfully'
        });
    } catch (error) {
        console.error('Error creating resignation:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

exports.getMyResignation = async (req, res) => {
    try {
        const resignation = await Resignation.findOne({ staff: req.staff.id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: resignation });
    } catch (error) {
        console.error('Error fetching resignation:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getAllResignations = async (req, res) => {
    try {
        const resignations = await Resignation.find()
            .populate('staff', 'fullName email department designation employeeType')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: resignations });
    } catch (error) {
        console.error('Error fetching all resignations:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateResignationStatus = async (req, res) => {
    try {
        const { action, comment, exitDate } = req.body; // action: 'approve' | 'reject'
        const approver = req.staff;

        const resignation = await Resignation.findById(req.params.id)
            .populate('staff', 'fullName email role systemRole reportingTo');

        if (!resignation) {
            return res.status(404).json({ success: false, message: 'Resignation request not found' });
        }

        const resigningStaff = resignation.staff;
        const isSuperAdmin = approver.role === 'super_admin' || approver.systemRole === 'super_admin';
        const isAdmin = approver.role === 'admin' || approver.systemRole === 'admin';
        const isHR = approver.role === 'hr' || approver.systemRole === 'hr';
        const isManager = resigningStaff.reportingTo && resigningStaff.reportingTo.toString() === approver._id.toString();

        // 1. Check if trying to modify a completed/rejected request
        if (['Completed', 'Rejected', 'Approved'].includes(resignation.status)) {
            return res.status(400).json({ success: false, message: 'Request is already finalized' });
        }

        // 2. Workflow Stage Logic
        switch (resignation.workflowStage) {
            case 'Manager Review':
                // Allowed: Direct Manager, Admin, Super Admin
                if (!isManager && !isAdmin && !isSuperAdmin) {
                     return res.status(403).json({ success: false, message: 'Only reporting manager or admin can review at this stage' });
                }

                if (action === 'approve') {
                    resignation.managerApproval = {
                        status: 'Approved',
                        comment: comment,
                        actionBy: approver._id,
                        actionDate: new Date()
                    };
                    resignation.workflowStage = 'HR Review';
                } else if (action === 'reject') {
                    resignation.managerApproval = {
                        status: 'Rejected',
                        comment: comment,
                        actionBy: approver._id,
                        actionDate: new Date()
                    };
                    resignation.status = 'Rejected';
                    resignation.workflowStage = 'Rejected';
                }
                break;

            case 'HR Review':
                // Allowed: HR, Admin, Super Admin
                if (!isHR && !isAdmin && !isSuperAdmin) {
                    return res.status(403).json({ success: false, message: 'Only HR or Admin can review at this stage' });
                }

                if (action === 'approve') {
                    resignation.hrApproval = {
                        status: 'Approved',
                        comment: comment,
                        actionBy: approver._id,
                        actionDate: new Date()
                    };
                    resignation.workflowStage = 'Final Approval';
                } else if (action === 'reject') {
                    resignation.hrApproval = {
                        status: 'Rejected',
                        comment: comment,
                        actionBy: approver._id,
                        actionDate: new Date()
                    };
                    resignation.status = 'Rejected';
                    resignation.workflowStage = 'Rejected';
                }
                break;

            case 'Final Approval':
                // Special Rule: If Resigning Staff is HR/Admin -> SUPER ADMIN ONLY
                const isResigningPrivileged = resigningStaff.role === 'hr' || resigningStaff.role === 'admin' || resigningStaff.role === 'super_admin';
                
                if (isResigningPrivileged) {
                    if (!isSuperAdmin) {
                        return res.status(403).json({ success: false, message: 'Final approval for HR/Admin/Management requires Super Admin' });
                    }
                } else {
                    // For regular staff: HR, Admin, Super Admin
                    if (!isHR && !isAdmin && !isSuperAdmin) {
                        return res.status(403).json({ success: false, message: 'Only HR or Admin can perform final approval' });
                    }
                }

                if (action === 'approve') {
                    if (!exitDate && !resignation.finalExitConfirmation?.exitDate) {
                         // Default to expected date if not provided
                    }
                    
                    resignation.finalExitConfirmation = {
                        exitDate: exitDate ? new Date(exitDate) : resignation.expectedLastWorkingDay,
                        comment: comment,
                        actionBy: approver._id,
                        actionDate: new Date()
                    };
                    resignation.status = 'Approved';
                    resignation.workflowStage = 'Completed';
                } else if (action === 'reject') {
                    resignation.status = 'Rejected';
                    resignation.workflowStage = 'Rejected';
                    resignation.finalExitConfirmation = {
                        comment: comment,
                        actionBy: approver._id,
                        actionDate: new Date()
                    };
                }
                break;

            default:
                return res.status(400).json({ success: false, message: 'Invalid workflow stage' });
        }

        await resignation.save();
        res.status(200).json({ success: true, data: resignation, message: `Request ${action}ed successfully` });

    } catch (error) {
        console.error('Error updating resignation status:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.uploadMiddleware = upload.single('letter');

exports.uploadResignationLetter = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }

        const result = await documentService.uploadDocument(req.file, 'resignation-letters');
        
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.status(200).json({ success: true, data: result.data, message: 'Resignation letter uploaded successfully' });
    } catch (error) {
        console.error('Error uploading resignation letter:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

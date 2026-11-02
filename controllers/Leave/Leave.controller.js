const Leave = require('../../models/Leave.model');
const Staff = require('../../models/Staff.model');
const Activity = require('../../models/Activity.model');

// Helper function to calculate working days
const calculateWorkingDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    // Exclude Saturdays (6) and Sundays (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  
  return count;
};

// Get current user's leave balance
exports.getMyLeaveBalance = async (req, res) => {
  try {
    const staffId = req.staff._id;

    // Get staff's current leave balance
    const staff = await Staff.findById(staffId).select('leaveBalance role systemRole employeeType isIntern');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Check and update leave balance if new year
    const currentYear = new Date().getFullYear();
    if (!staff.leaveBalance || !staff.leaveBalance.lastResetDate || 
        new Date(staff.leaveBalance.lastResetDate).getFullYear() < currentYear) {
      // Reset leave balance for new year
      const isIntern = staff.role === 'intern' || staff.systemRole === 'intern' || staff.employeeType === 'intern' || staff.isIntern === true;
      staff.leaveBalance = {
        casual: isIntern ? 0 : 12,
        medical: isIntern ? 5 : 10,
        maternity: isIntern ? 0 : 15,
        lastResetDate: new Date()
      };
      await staff.save();
    }

    // Get leaves already taken this year
    const leaves = await Leave.find({
      staffId,
      status: 'approved',
      startDate: {
        $gte: new Date(currentYear, 0, 1),
        $lte: new Date(currentYear, 11, 31)
      }
    });

    // Calculate remaining balance
    const takenByType = {
      casual: 0,
      medical: 0,
      maternity: 0,
      sick: 0,
      paid: 0
    };

    leaves.forEach(leave => {
      const type = leave.leaveType === 'sick' ? 'medical' : leave.leaveType;
      if (takenByType[type] !== undefined) {
        takenByType[type] += leave.totalDays;
      }
    });

    const isIntern = staff.role === 'intern' || staff.systemRole === 'intern' || staff.employeeType === 'intern' || staff.isIntern === true;
    const casualTotal = isIntern ? 0 : 12;

    // Monthly short leaves taken
    const startOfCurrentMonth = new Date(currentYear, new Date().getMonth(), 1);
    const endOfCurrentMonth = new Date(currentYear, new Date().getMonth() + 1, 0, 23, 59, 59);
    const shortLeavesThisMonth = await Leave.countDocuments({
      staffId,
      leaveType: 'short_leave',
      status: { $in: ['approved', 'pending'] },
      startDate: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth }
    });

    const balance = {
      casual: {
        total: casualTotal,
        taken: isIntern ? 0 : takenByType.casual,
        remaining: isIntern ? 0 : Math.max(0, casualTotal - takenByType.casual),
        eligible: !isIntern
      },
      medical: {
        total: isIntern ? 0 : 10,
        taken: isIntern ? 0 : takenByType.medical + takenByType.sick,
        remaining: isIntern ? 0 : Math.max(0, 10 - (takenByType.medical + takenByType.sick)),
        eligible: !isIntern
      },
      maternity: {
        total: isIntern ? 0 : 15,
        taken: isIntern ? 0 : takenByType.maternity,
        remaining: isIntern ? 0 : Math.max(0, 15 - takenByType.maternity),
        eligible: !isIntern
      },
      short_leave: {
        allowedPerMonth: 2,
        takenThisMonth: shortLeavesThisMonth,
        remainingThisMonth: Math.max(0, 2 - shortLeavesThisMonth)
      },
      // Backward compatibility aliases to prevent crashes in existing views
      sick: {
        total: isIntern ? 0 : 10,
        taken: isIntern ? 0 : takenByType.medical + takenByType.sick,
        remaining: isIntern ? 0 : Math.max(0, 10 - (takenByType.medical + takenByType.sick)),
        eligible: !isIntern
      },
      paid: {
        total: isIntern ? 0 : 15,
        taken: isIntern ? 0 : takenByType.maternity + takenByType.paid,
        remaining: isIntern ? 0 : Math.max(0, 15 - (takenByType.maternity + takenByType.paid)),
        eligible: !isIntern
      }
    };

    res.status(200).json({
      success: true,
      data: {
        leaveBalance: staff.leaveBalance,
        balance,
        currentYear,
        isIntern,
        role: staff.role
      }
    });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave balance',
      error: error.message
    });
  }
};

// Apply for leave
exports.applyLeave = async (req, res) => {
  try {
    const staffId = req.staff._id;
    const { leaveType, startDate, endDate, reason } = req.body;

    const currentYear = new Date().getFullYear();
    const staff = await Staff.findById(staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    const isInternStaff = staff.role === 'intern' || staff.systemRole === 'intern' || staff.employeeType === 'intern' || staff.isIntern === true;

    // Calculate working days
    const totalDays = calculateWorkingDays(startDate, endDate);
    if (totalDays <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected date range contains 0 working days.'
      });
    }

    let paidDays = totalDays;
    let nonPaidDays = 0;
    let leaveBreakdownNote = '';

    // CASE 1: Intern applying for leave
    if (isInternStaff) {
      if (leaveType === 'short_leave') {
        const reqStart = new Date(startDate);
        const startOfMonth = new Date(reqStart.getFullYear(), reqStart.getMonth(), 1);
        const endOfMonth = new Date(reqStart.getFullYear(), reqStart.getMonth() + 1, 0, 23, 59, 59);

        const monthShortLeaves = await Leave.countDocuments({
          staffId,
          leaveType: 'short_leave',
          status: { $in: ['approved', 'pending'] },
          startDate: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (monthShortLeaves + totalDays > 2) {
          return res.status(400).json({
            success: false,
            message: 'Policy Limit: Interns are permitted a maximum of 2 short leaves per month.'
          });
        }
        paidDays = totalDays;
        nonPaidDays = 0;
        leaveBreakdownNote = `Intern Short Leave (${totalDays} day(s) within monthly limit of 2).`;
      } else {
        // Interns have NO paid leaves (casual/medical/etc.). Marked as Non-Paid Leave (LWP)
        paidDays = 0;
        nonPaidDays = totalDays;
        leaveBreakdownNote = `Intern Policy: Interns are not eligible for paid leaves. All ${totalDays} day(s) marked as Non-Paid Leave (LWP).`;
      }
    } else {
      // CASE 2: Regular employee applying for leave
      if (leaveType === 'casual') {
        const reqStart = new Date(startDate);
        const startOfMonth = new Date(reqStart.getFullYear(), reqStart.getMonth(), 1);
        const endOfMonth = new Date(reqStart.getFullYear(), reqStart.getMonth() + 1, 0, 23, 59, 59);

        const monthLeaves = await Leave.find({
          staffId,
          leaveType: 'casual',
          status: { $in: ['approved', 'pending'] },
          startDate: { $gte: startOfMonth, $lte: endOfMonth }
        });

        const monthCasualPaidDaysTaken = monthLeaves.reduce((acc, l) => acc + (l.paidDays !== undefined ? l.paidDays : l.totalDays || 0), 0);
        const maxPaidPerMonth = 2;
        const availablePaidThisMonth = Math.max(0, maxPaidPerMonth - monthCasualPaidDaysTaken);

        paidDays = Math.min(totalDays, availablePaidThisMonth);
        nonPaidDays = Math.max(0, totalDays - paidDays);

        if (nonPaidDays > 0) {
          if (paidDays > 0) {
            leaveBreakdownNote = `${paidDays} day(s) marked as Casual Leave (Paid), and ${nonPaidDays} day(s) exceeding monthly 2-day limit marked as Non-Paid Leave (LWP).`;
          } else {
            leaveBreakdownNote = `Monthly 2-day casual leave quota exhausted. All ${nonPaidDays} day(s) marked as Non-Paid Leave (LWP).`;
          }
        } else {
          leaveBreakdownNote = `${paidDays} day(s) marked as Casual Leave (Paid).`;
        }
      } else if (leaveType === 'short_leave') {
        const reqStart = new Date(startDate);
        const startOfMonth = new Date(reqStart.getFullYear(), reqStart.getMonth(), 1);
        const endOfMonth = new Date(reqStart.getFullYear(), reqStart.getMonth() + 1, 0, 23, 59, 59);

        const monthShortLeaves = await Leave.countDocuments({
          staffId,
          leaveType: 'short_leave',
          status: { $in: ['approved', 'pending'] },
          startDate: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (monthShortLeaves + totalDays > 2) {
          return res.status(400).json({
            success: false,
            message: 'Policy Limit: A maximum of 2 short leaves are permitted per month.'
          });
        }
        paidDays = totalDays;
        nonPaidDays = 0;
        leaveBreakdownNote = `Short Leave (${totalDays} day(s) within monthly limit of 2).`;
      } else {
        // Other leave types
        paidDays = leaveType === 'lwp' ? 0 : totalDays;
        nonPaidDays = leaveType === 'lwp' ? totalDays : 0;
        leaveBreakdownNote = leaveType === 'lwp'
          ? `Leave Without Pay (${totalDays} day(s) non-paid).`
          : `${totalDays} day(s) ${leaveType} leave.`;
      }
    }

    const leave = new Leave({
      staffId,
      leaveType: isInternStaff && leaveType !== 'short_leave' ? 'lwp' : leaveType,
      startDate,
      endDate,
      totalDays,
      paidDays,
      nonPaidDays,
      leaveBreakdownNote,
      isInternLeave: isInternStaff,
      reason,
      status: 'pending'
    });

    await leave.save();

    // Log Activity
    await Activity.create({
      type: 'leave_applied',
      user: req.staff.fullName,
      actorId: staffId,
      action: `applied for ${isInternStaff ? 'intern non-paid leave' : leaveType}`,
      target: `${totalDays} days (${paidDays} paid, ${nonPaidDays} non-paid)`,
      targetId: leave._id,
      metadata: { leaveType, totalDays, paidDays, nonPaidDays, startDate, endDate, leaveBreakdownNote }
    });

    await leave.populate('staffId', 'fullName email department designation');

    res.status(201).json({
      success: true,
      message: leaveBreakdownNote ? `Leave submitted: ${leaveBreakdownNote}` : 'Leave application submitted successfully',
      data: leave
    });
  } catch (error) {
    console.error('Error applying leave:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply for leave',
      error: error.message
    });
  }
};

// Get my leave history
exports.getMyLeaves = async (req, res) => {
  try {
    const staffId = req.staff._id;
    const { status, year } = req.query;

    const query = { staffId };
    
    if (status) {
      query.status = status;
    }

    if (year) {
      const startOfYear = new Date(parseInt(year), 0, 1);
      const endOfYear = new Date(parseInt(year), 11, 31, 23, 59, 59);
      query.startDate = { $gte: startOfYear, $lte: endOfYear };
    }

    const leaves = await Leave.find(query)
      .sort({ createdAt: -1 })
      .populate('approvedBy', 'fullName email');

    res.status(200).json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Error fetching leave history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave history',
      error: error.message
    });
  }
};

// Get pending leave requests (for approvers)
exports.getPendingLeaves = async (req, res) => {
  try {
    const { role, department } = req.staff;

    let query = { status: 'pending' };

    // If HR, they can only see non-HR staff requests (HR requests go to Super Admin)
    if (role === 'hr') {
      query.$or = [
        { 'staffId.role': { $ne: 'hr' } }
      ];
    }

    const leaves = await Leave.find(query)
      .sort({ createdAt: -1 })
      .populate('staffId', 'fullName email department designation role');

    res.status(200).json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Error fetching pending leaves:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending leaves',
      error: error.message
    });
  }
};

// Get all leave requests (for Super Admin/Admin)
exports.getAllLeaves = async (req, res) => {
  try {
    const { status, leaveType, department, year, month } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (leaveType) {
      query.leaveType = leaveType;
    }

    if (department) {
      query['staffId.department'] = department;
    }

    if (year) {
      const startOfYear = new Date(parseInt(year), 0, 1);
      const endOfYear = new Date(parseInt(year), 11, 31, 23, 59, 59);
      query.startDate = { $gte: startOfYear, $lte: endOfYear };
    }

    if (month) {
      const startOfMonth = new Date(parseInt(year || new Date().getFullYear()), parseInt(month) - 1, 1);
      const endOfMonth = new Date(parseInt(year || new Date().getFullYear()), parseInt(month), 0, 23, 59, 59);
      query.startDate = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const leaves = await Leave.find(query)
      .sort({ createdAt: -1 })
      .populate('staffId', 'fullName email department designation role')
      .populate('approvedBy', 'fullName email');

    res.status(200).json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Error fetching all leaves:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaves',
      error: error.message
    });
  }
};

// Approve leave request
exports.approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const approverId = req.staff._id;
    const { role } = req.staff;

    const leave = await Leave.findById(id).populate('staffId');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave request is not pending'
      });
    }

    // Check authorization
    // HR leaves can only be approved by Super Admin
    if (leave.staffId.role === 'hr' && role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'HR leave requests can only be approved by Super Admin'
      });
    }

    // Regular staff leaves can be approved by Super Admin, Admin, or HR
    if (!['super_admin', 'admin', 'hr'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve leave requests'
      });
    }

    const isInternTarget = leave.staffId && (leave.staffId.role === 'intern' || leave.staffId.systemRole === 'intern' || leave.staffId.employeeType === 'intern' || leave.staffId.isIntern === true);
    if (isInternTarget && leave.leaveType === 'casual') {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve casual leave: Interns are not approved/eligible for casual leaves during their internship period.'
      });
    }

    leave.status = 'approved';
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();

    await leave.save();

    // Log Activity
    await Activity.create({
        type: 'leave_approved',
        user: req.staff.fullName,
        actorId: approverId,
        action: `approved leave for ${leave.staffId.fullName}`,
        target: leave.staffId.fullName,
        targetId: leave._id,
        metadata: { leaveType: leave.leaveType, totalDays: leave.totalDays }
    });

    // Populate for response
    await leave.populate('staffId', 'fullName email department designation');
    await leave.populate('approvedBy', 'fullName email');

    res.status(200).json({
      success: true,
      message: 'Leave request approved successfully',
      data: leave
    });
  } catch (error) {
    console.error('Error approving leave:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve leave request',
      error: error.message
    });
  }
};

// Reject leave request
exports.rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const approverId = req.staff._id;
    const { role } = req.staff;
    const { reason } = req.body;

    const leave = await Leave.findById(id).populate('staffId');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave request is not pending'
      });
    }

    // Check authorization
    if (leave.staffId.role === 'hr' && role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'HR leave requests can only be rejected by Super Admin'
      });
    }

    if (!['super_admin', 'admin', 'hr'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject leave requests'
      });
    }

    leave.status = 'rejected';
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();
    leave.rejectionReason = reason;

    await leave.save();

    await leave.populate('staffId', 'fullName email department designation');
    await leave.populate('approvedBy', 'fullName email');

    res.status(200).json({
      success: true,
      message: 'Leave request rejected successfully',
      data: leave
    });

    // Log Activity
    await Activity.create({
        type: 'leave_rejected',
        user: req.staff.fullName,
        actorId: approverId,
        action: `rejected leave for ${leave.staffId.fullName}`,
        target: leave.staffId.fullName,
        targetId: leave._id,
        metadata: { reason, leaveType: leave.leaveType }
    });
  } catch (error) {
    console.error('Error rejecting leave:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject leave request',
      error: error.message
    });
  }
};

// Cancel own leave request
exports.cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const staffId = req.staff._id;

    const leave = await Leave.findOne({ _id: id, staffId });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found or unauthorized'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending leave requests can be cancelled'
      });
    }

    await Leave.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Leave request cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling leave:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel leave request',
      error: error.message
    });
  }
};

// Get leave statistics
exports.getLeaveStats = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const stats = {
      total: await Leave.countDocuments({
        createdAt: { $gte: startOfYear, $lte: endOfYear }
      }),
      pending: await Leave.countDocuments({
        status: 'pending',
        createdAt: { $gte: startOfYear, $lte: endOfYear }
      }),
      approved: await Leave.countDocuments({
        status: 'approved',
        createdAt: { $gte: startOfYear, $lte: endOfYear }
      }),
      rejected: await Leave.countDocuments({
        status: 'rejected',
        createdAt: { $gte: startOfYear, $lte: endOfYear }
      }),
      byType: {
        casual: await Leave.countDocuments({
          leaveType: 'casual',
          status: 'approved',
          createdAt: { $gte: startOfYear, $lte: endOfYear }
        }),
        sick: await Leave.countDocuments({
          leaveType: 'sick',
          status: 'approved',
          createdAt: { $gte: startOfYear, $lte: endOfYear }
        }),
        paid: await Leave.countDocuments({
          leaveType: 'paid',
          status: 'approved',
          createdAt: { $gte: startOfYear, $lte: endOfYear }
        })
      }
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching leave stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave statistics',
      error: error.message
    });
  }
};


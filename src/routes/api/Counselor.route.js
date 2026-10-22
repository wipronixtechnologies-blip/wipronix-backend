const express = require('express');
const router = express.Router();
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');
const counselorController = require('../../../controllers/Counselor/counselorController');

// Protect all counselor routes with staff authentication
router.use(authenticateStaff);

// Restrict access: Only Super Admin, Admin, and TL / BDE in Marketing team
const authorizeCounselor = (req, res, next) => {
  const staff = req.staff;
  if (!staff) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const role = (staff.role || '').toLowerCase();
  const systemRole = (staff.systemRole || '').toLowerCase();
  const designation = (staff.designation || '').toLowerCase();
  const department = (staff.department || '').toLowerCase();

  const isSuperAdmin = ['super_admin', 'superadmin'].includes(role) || ['super_admin', 'superadmin'].includes(systemRole);
  const isAdmin = role === 'admin' || systemRole === 'admin';
  const isMarketing = department.includes('marketing') || (staff.permissions && staff.permissions.some(p => p.startsWith('Marketing:')));
  const isTL = ['tl'].includes(role) || ['tl'].includes(systemRole) || designation.includes('tl') || designation.includes('team lead');
  const isBDE = ['bde'].includes(role) || ['bde'].includes(systemRole) || designation.includes('bde') || designation.includes('counselor');

  if (isSuperAdmin || isAdmin || (isMarketing && (isTL || isBDE)) || (isTL && isMarketing) || (isBDE && (isMarketing || role === 'bde' || systemRole === 'bde'))) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied: The Counselor section is restricted to Admin, Super Admin, and Marketing Team TLs and BDEs only.'
  });
};

router.use(authorizeCounselor);

// Overview Stats
router.get('/overview', counselorController.getCounselorOverview);

// BDE List with stats
router.get('/bdes', counselorController.getBDEs);

// College Student Pool Stats
router.get('/colleges-stats', counselorController.getCollegesStudentStats);

// All Unique College Names List
router.get('/colleges-list', counselorController.getAllCollegeNames);

// College Student Pool Breakdown by Course and Semester
router.get('/pool-breakdown', counselorController.getPoolBreakdown);

// Assigned/Unassigned Students with Filters
router.get('/students', counselorController.getAssignedStudents);

// My Assigned Students (for logged-in counselor)
router.get('/my-students', counselorController.getMyAssignedStudents);


// Restrict Assign/Reassign actions to Super Admin, Admin, and Marketing Team TLs only
const authorizeAssigner = (req, res, next) => {
  const staff = req.staff;
  if (!staff) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const role = (staff.role || '').toLowerCase();
  const systemRole = (staff.systemRole || '').toLowerCase();
  const designation = (staff.designation || '').toLowerCase();
  const department = (staff.department || '').toLowerCase();

  const isSuperAdmin = ['super_admin', 'superadmin'].includes(role) || ['super_admin', 'superadmin'].includes(systemRole);
  const isAdmin = role === 'admin' || systemRole === 'admin';
  const isMarketing = department.includes('marketing') || (staff.permissions && staff.permissions.some(p => p.startsWith('Marketing:')));
  const isTL = ['tl'].includes(role) || ['tl'].includes(systemRole) || designation.includes('tl') || designation.includes('team lead');

  if (isSuperAdmin || isAdmin || (isTL && (isMarketing || role === 'tl' || systemRole === 'tl'))) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied: Only Team Leads and Administrators can assign or reassign students.'
  });
};

// Assign Students (sequential remaining distribution)
router.post('/assign-students', authorizeAssigner, counselorController.assignStudents);

// Unassign Students
router.post('/unassign-students', authorizeAssigner, counselorController.unassignStudents);

// Reassign Students
router.post('/reassign-students', authorizeAssigner, counselorController.reassignStudents);

// Update Status & Notes
router.patch('/student-status/:id', counselorController.updateCounselingStatus);

// Update Full Student Details (info, phones, stages, demo, admission)
router.put('/student/:id', counselorController.updateStudentDetails);
router.patch('/student/:id', counselorController.updateStudentDetails);

// TL Team Counselor Oversight & Untouched Leads Analytics
router.get('/tl-team-performance', counselorController.getTLTeamPerformance);

// Send Catch-Up / Follow-Up Reminder Notification to BDE
router.post('/notify-bde-reminder', counselorController.sendBDEReminderNotification);

// Add Lead directly by Counselor / Admin
router.post('/add-lead', counselorController.addLead);

// Generate 2-Hour Protected Assessment Link
router.post('/generate-test-link', counselorController.generateTestLink);

// Log Call Details and Schedule Follow-Up
router.post('/log-call', counselorController.logCallAndFollowUp);

// Get Call History Timeline
router.get('/call-history/:studentId', counselorController.getCallHistory);

module.exports = router;

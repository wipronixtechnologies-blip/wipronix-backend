const express = require('express');
const router = express.Router();
const Student = require('../../../models/Student.model');
const Result = require('../../../models/Result.model');

/**
 * Check if candidate has been invited to Smart Cut
 * GET /api/smart-cut/check-invite?email=...
 */
router.get('/check-invite', async (req, res) => {
  try {
    const rawEmail = req.query.email || '';
    const email = rawEmail.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        isInvited: false,
        message: 'Email parameter is required.'
      });
    }

    // 1. Search in Student collection
    const student = await Student.findOne({
      email,
      smartCutInvited: true
    }).select('fullName email phoneNumber college course technology smartCutInvited smartCutInvitedAt smartCutChannel counselingStatus isSelected isShortlisted');

    if (student) {
      return res.status(200).json({
        success: true,
        isInvited: true,
        source: 'student',
        candidate: {
          id: student._id,
          fullName: student.fullName,
          email: student.email,
          phoneNumber: student.phoneNumber || '',
          college: student.college || 'Wipronix Partner College',
          course: student.course || 'B.Tech / Degree',
          technology: student.technology || 'Core Engineering',
          invitedAt: student.smartCutInvitedAt,
          channel: student.smartCutChannel || 'email',
          status: student.isSelected ? 'selected' : (student.isShortlisted ? 'shortlisted' : 'interested')
        }
      });
    }

    // 2. Search in Campus Drive Result collection
    const result = await Result.findOne({
      studentEmail: email,
      smartCutInvited: true
    }).select('studentName studentEmail studentPhone collegeName course technology smartCutInvited smartCutInvitedAt smartCutChannel isSelected isShortlisted');

    if (result) {
      return res.status(200).json({
        success: true,
        isInvited: true,
        source: 'result',
        candidate: {
          id: result._id,
          fullName: result.studentName,
          email: result.studentEmail,
          phoneNumber: result.studentPhone || '',
          college: result.collegeName || 'Campus Placement Drive',
          course: result.course || 'Engineering',
          technology: result.technology || 'Software Engineering',
          invitedAt: result.smartCutInvitedAt,
          channel: result.smartCutChannel || 'email',
          status: result.isSelected ? 'selected' : 'shortlisted'
        }
      });
    }

    // Not invited
    return res.status(200).json({
      success: true,
      isInvited: false,
      message: 'Candidate has not been invited to Smart Cut portal.'
    });
  } catch (error) {
    console.error('Error in /smart-cut/check-invite:', error);
    return res.status(500).json({
      success: false,
      isInvited: false,
      message: error.message
    });
  }
});

/**
 * Verify candidate access for Smart Cut login
 * POST /api/smart-cut/verify-access
 */
router.post('/verify-access', async (req, res) => {
  try {
    const rawEmail = req.body.email || '';
    const email = rawEmail.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.'
      });
    }

    // Check Student model first
    const student = await Student.findOne({
      email,
      smartCutInvited: true
    });

    if (student) {
      return res.status(200).json({
        success: true,
        allowed: true,
        candidate: {
          id: student._id,
          fullName: student.fullName,
          email: student.email,
          phoneNumber: student.phoneNumber,
          college: student.college,
          course: student.course,
          technology: student.technology,
          invitedAt: student.smartCutInvitedAt
        }
      });
    }

    // Check Result model
    const result = await Result.findOne({
      studentEmail: email,
      smartCutInvited: true
    });

    if (result) {
      return res.status(200).json({
        success: true,
        allowed: true,
        candidate: {
          id: result._id,
          fullName: result.studentName,
          email: result.studentEmail,
          phoneNumber: result.studentPhone,
          college: result.collegeName,
          course: result.course,
          technology: result.technology,
          invitedAt: result.smartCutInvitedAt
        }
      });
    }

    // Not invited -> Deny Access
    return res.status(403).json({
      success: false,
      allowed: false,
      message: 'Access Denied: You have not received an invitation to the Smart Cut portal. Only candidates who have received an official Smart Cut invitation can access this portal.'
    });
  } catch (error) {
    console.error('Error in /smart-cut/verify-access:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get all invited candidates across Student & Result collections
 * GET /api/smart-cut/invited-candidates
 */
router.get('/invited-candidates', async (req, res) => {
  try {
    const [invitedStudents, invitedResults] = await Promise.all([
      Student.find({ smartCutInvited: true }).select('fullName email phoneNumber college course technology smartCutInvitedAt smartCutChannel').lean(),
      Result.find({ smartCutInvited: true }).select('studentName studentEmail studentPhone collegeName course technology smartCutInvitedAt smartCutChannel').lean()
    ]);

    const candidates = [
      ...invitedStudents.map(s => ({
        id: s._id,
        fullName: s.fullName,
        email: s.email,
        phoneNumber: s.phoneNumber || '',
        college: s.college || '',
        course: s.course || '',
        technology: s.technology || '',
        invitedAt: s.smartCutInvitedAt,
        channel: s.smartCutChannel || 'email',
        source: 'student'
      })),
      ...invitedResults.map(r => ({
        id: r._id,
        fullName: r.studentName,
        email: r.studentEmail,
        phoneNumber: r.studentPhone || '',
        college: r.collegeName || '',
        course: r.course || '',
        technology: r.technology || '',
        invitedAt: r.smartCutInvitedAt,
        channel: r.smartCutChannel || 'email',
        source: 'campus'
      }))
    ];

    res.status(200).json({
      success: true,
      count: candidates.length,
      candidates
    });
  } catch (error) {
    console.error('Error in /smart-cut/invited-candidates:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

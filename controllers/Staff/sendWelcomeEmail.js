const Staff = require('../../models/Staff.model');
const { generateOfferLetterPDF } = require('./generateOfferLetter');
const { sendStaffWelcomeEmail } = require('../../src/services/emailService');

exports.sendWelcomeEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};

    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Use provided password, or default to phone number
    const welcomePassword = password || staff.phoneNumber || 'Establish your password via Forgot Password';
    const { signingName, signingDesignation } = req.body;

    // Generate PDF
    const pdfBuffer = await generateOfferLetterPDF(staff._id, { signingName, signingDesignation });

    // Send Email
    const emailResult = await sendStaffWelcomeEmail(staff, welcomePassword, pdfBuffer);

    if (emailResult.success) {
      res.status(200).json({
        success: true,
        message: `Welcome email with offer letter sent successfully to ${staff.email}`
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send email',
        error: emailResult.error
      });
    }
  } catch (error) {
    console.error('Error sending manual welcome email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

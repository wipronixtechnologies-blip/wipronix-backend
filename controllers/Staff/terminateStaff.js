const Staff = require('../../models/Staff.model');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter for sending emails
const createTransporter = () => {
  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_PASS = process.env.GMAIL_PASS;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER || 'your-email@gmail.com',
      pass: GMAIL_PASS || 'your-app-password',
    },
  });
};

// Generate termination letter PDF
const generateTerminationLetterPDF = (staffData, terminationDate, reason) => {
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('WIP/HR/2026/TERMINATION', pageWidth - 50, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, pageWidth - 50, 26);
  
  // Dear Employee
  doc.setFontSize(12);
  doc.text(`Dear ${staffData.fullName},`, 20, 45);
  
  doc.setFontSize(11);
  const introText = 'We regret to inform you that your employment with Wipronix Technologies Pvt. Ltd. has been terminated.';
  doc.text(introText, 20, 55);
  
  // Details
  let yPos = 75;
  doc.setFont('helvetica', 'bold');
  doc.text('Termination Details:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  
  yPos += 10;
  doc.text(`Effective Date: ${terminationDate}`, 25, yPos);
  
  yPos += 8;
  doc.text(`Reason: ${reason || 'As per company policy'}`, 25, yPos);
  
  yPos += 20;
  doc.setFont('helvetica', 'bold');
  doc.text('Final Settlement:', 20, yPos);
  doc.setFont('helvetica', 'normal');
  
  yPos += 10;
  doc.text('All outstanding salary and benefits will be settled as per company policy.', 25, yPos);
  
  yPos += 20;
  doc.text('You are requested to return all company property, ID card, and complete', 20, yPos);
  yPos += 8;
  doc.text('the exit formalities within the stipulated time period.', 20, yPos);
  
  yPos += 20;
  doc.text('We thank you for your association with Wipronix Technologies Pvt. Ltd.', 20, yPos);
  
  yPos += 25;
  doc.text('Warm regards,', 20, yPos);
  doc.text('For Wipronix Technologies Pvt. Ltd.', 20, yPos + 10);
  doc.text('Harish Chawla', 20, yPos + 20);
  doc.text('CEO', 20, yPos + 28);
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('www.wipronix.com | hr@wipronix.com | 9646706113', pageWidth / 2, footerY, { align: 'center' });
  
  return doc;
};

// Terminate staff controller
const terminateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { terminationDate, reason, sendEmail } = req.body;
    const requestingStaff = req.staff;

    // Check if user is super_admin or hr
    if (requestingStaff.role !== 'super_admin' && requestingStaff.role !== 'hr') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin or HR can terminate staff'
      });
    }

    // Find staff member
    const staffMember = await Staff.findById(id);
    
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check if already terminated
    if (!staffMember.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Staff member is already inactive'
      });
    }

    // Update staff status
    staffMember.isActive = false;
    staffMember.terminationDate = terminationDate || new Date();
    staffMember.terminationReason = reason || 'As per company policy';
    staffMember.terminationBy = requestingStaff._id;
    
    await staffMember.save();

    // Send termination email if requested
    if (sendEmail) {
      const doc = generateTerminationLetterPDF(
        { fullName: staffMember.fullName },
        terminationDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        reason
      );
      const pdfBuffer = doc.output('arraybuffer');

      const transporter = createTransporter();
      
      const mailOptions = {
        from: process.env.GMAIL_USER || 'your-email@gmail.com',
        to: staffMember.email,
        subject: 'Termination Letter - Wipronix Technologies Pvt. Ltd.',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Termination Notice</h2>
            <p>Dear ${staffMember.fullName},</p>
            <p>We regret to inform you that your employment with Wipronix Technologies Pvt. Ltd. has been terminated.</p>
            <p>Please find attached the termination letter for your records.</p>
            <br/>
            <p>Best regards,</p>
            <p>HR Department</p>
            <p>Wipronix Technologies Pvt. Ltd.</p>
          </div>
        `,
        attachments: [
          {
            filename: `TerminationLetter_${staffMember.fullName.replace(/\s+/g, '_')}.pdf`,
            content: Buffer.from(pdfBuffer)
          }
        ]
      };

      await transporter.sendMail(mailOptions);
    }

    return res.status(200).json({
      success: true,
      message: 'Staff member terminated successfully'
    });

  } catch (error) {
    console.error('Error terminating staff:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to terminate staff'
    });
  }
};

module.exports = { terminateStaff };

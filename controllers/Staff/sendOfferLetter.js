const Staff = require('../../models/Staff.model');
const nodemailer = require('nodemailer');
const { jsPDF } = require('jspdf');
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

// Generate offer letter PDF content
const generateOfferLetterPDF = (staffData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Company Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('WIP/HR/2026/006', pageWidth - 50, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, pageWidth - 50, 26);
  
  // Dear Employee
  doc.setFontSize(12);
  doc.text(`Dear ${staffData.fullName},`, 20, 45);
  
  // Opening paragraph
  doc.setFontSize(11);
  const introText = 'We are pleased to offer you employment with Wipronix Technologies Pvt. Ltd. for the position of';
  doc.text(introText, 20, 55);
  
  doc.setFont('helvetica', 'bold');
  doc.text(staffData.designation || 'BDE', 20 + doc.getTextWidth(introText), 55);
  
  doc.setFont('helvetica', 'normal');
  doc.text('in the Marketing, subject to the terms and conditions outlined below.', 20, 62);
  
  // Terms and Conditions
  let yPos = 80;
  doc.setFont('helvetica', 'bold');
  doc.text('1. Appointment & Reporting', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`You are appointed as ${staffData.designation || 'BDE'} and will report to`, 25, yPos + 7);
  
  // Get reporting manager name
  const reportingTo = staffData.reportingToName || 'Abhishek Rana (Training Head)';
  doc.text(`${reportingTo} or any other person as assigned by the management from time to time.`, 25, yPos + 14);
  
  yPos += 25;
  doc.setFont('helvetica', 'bold');
  doc.text('2. Date of Joining', 20, yPos);
  doc.setFont('helvetica', 'normal');
  const joiningDate = staffData.dateOfJoining 
    ? new Date(staffData.dateOfJoining).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.text(`Your appointment shall commence on ${joiningDate}. You are required to report at Office and complete all joining formalities on this date.`, 25, yPos + 7);
  
  yPos += 18;
  doc.setFont('helvetica', 'bold');
  doc.text('3. Nature of Employment & Probation', 20, yPos);
  doc.setFont('helvetica', 'normal');
  const empType = staffData.employeeType === 'full_time' ? 'Full-time' : 
                  staffData.employeeType === 'part_time' ? 'Part-time' :
                  staffData.employeeType === 'contract' ? 'Contract' : 'Intern';
  doc.text(`This employment shall be ${empType}.`, 25, yPos + 7);
  doc.text('You will be on probation for a period of three (3) months from the date of joining. Upon satisfactory', 25, yPos + 14);
  doc.text('completion of probation, your employment may be confirmed at the sole discretion of management.', 25, yPos + 21);
  
  yPos += 32;
  doc.setFont('helvetica', 'bold');
  doc.text('4. Roles & Responsibilities', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('Your duties shall include responsibilities assigned to your role and any other tasks entrusted to you', 25, yPos + 7);
  doc.text('in the interest of the organization. You are expected to perform your duties with integrity, diligence,', 25, yPos + 14);
  doc.text('and professionalism.', 25, yPos + 21);
  
  yPos += 32;
  doc.setFont('helvetica', 'bold');
  doc.text('5. Compensation Structure', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('a) Fixed Compensation', 25, yPos + 7);
  const salary = staffData.salaryStructure?.baseSalary || 15000;
  doc.text(`You shall be paid a consolidated salary of INR ${salary.toLocaleString()}/- per month, subject to statutory deductions,`, 30, yPos + 14);
  doc.text('payable as per company payroll policy.', 30, yPos + 21);
  
  doc.text('b) Performance-Based Incentives', 25, yPos + 28);
  doc.text('You may be eligible for performance-linked incentives as per applicable company policies, based', 30, yPos + 35);
  doc.text('strictly on measurable performance parameters.', 30, yPos + 42);
  
  doc.text('c) Retention Bonus', 25, yPos + 49);
  doc.text('A Retention Bonus of INR [Amount]/- shall be payable upon successful completion of 12 months', 30, yPos + 56);
  doc.text('of continuous service with satisfactory performance.', 30, yPos + 63);
  doc.text('This bonus shall stand forfeited in the event of resignation or termination prior to completion of the', 30, yPos + 70);
  doc.text('retention period.', 30, yPos + 77);
  
  yPos += 95;
  doc.setFont('helvetica', 'bold');
  doc.text('6. Confidentiality & Intellectual Property', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('You shall maintain strict confidentiality of all business information, client data, intellectual property,', 25, yPos + 7);
  doc.text('and internal processes during and after your employment with the company.', 25, yPos + 14);
  
  yPos += 25;
  doc.setFont('helvetica', 'bold');
  doc.text('7. Code of Conduct', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('You shall comply with all company policies, rules, and professional standards as amended from time to time.', 25, yPos + 7);
  
  yPos += 18;
  doc.setFont('helvetica', 'bold');
  doc.text('8. Termination', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('During the probation period, either party may terminate this employment by providing 15 days\' written notice.', 25, yPos + 7);
  doc.text('The company reserves the right to terminate employment without notice in cases of misconduct,', 25, yPos + 14);
  doc.text('policy violation, or breach of trust.', 25, yPos + 21);
  
  yPos += 32;
  doc.setFont('helvetica', 'bold');
  doc.text('9. Acceptance', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('Please sign and return a copy of this letter as acceptance of the offer. This offer shall be deemed', 25, yPos + 7);
  doc.text('null and void if you fail to join on the specified date.', 25, yPos + 14);
  
  yPos += 30;
  doc.text('We welcome you to Wipronix Technologies Pvt. Ltd. and look forward to a professional association.', 20, yPos);
  
  yPos += 20;
  doc.text('Warm regards,', 20, yPos);
  doc.text('For Wipronix Technologies Pvt. Ltd.', 20, yPos + 10);
  doc.text('Harish Chawla', 20, yPos + 20);
  doc.text('CEO', 20, yPos + 28);
  doc.text('Contact: 9646706113', 20, yPos + 36);
  
  // Footer on each page
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('www.wipronix.com | hr@wipronix.com | 9646706113', pageWidth / 2, footerY, { align: 'center' });
  
  return doc;
};

// Send offer letter controller
const sendOfferLetter = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingStaff = req.staff;

    // Check if user is super_admin
    if (!requestingStaff || requestingStaff.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can send offer letters'
      });
    }

    // Find staff member
    const staffMember = await Staff.findById(id).populate('reportingTo', 'fullName');
    
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check if documents are verified (HR should verify documents)
    const documents = staffMember.documents;
    
    // Check if at least one document is uploaded and has a URL
    const hasDocuments = documents && (
      (documents.identityProof && documents.identityProof.url && documents.identityProof.url !== '') || 
      (documents.educationalCertificate && documents.educationalCertificate.url && documents.educationalCertificate.url !== '') || 
      (documents.offerLetter && documents.offerLetter.url && documents.offerLetter.url !== '') || 
      (documents.medicalDocument && documents.medicalDocument.url && documents.medicalDocument.url !== '')
    );

    if (!hasDocuments) {
      return res.status(400).json({
        success: false,
        message: 'Documents not uploaded. Please upload required documents before generating offer letter.'
      });
    }

    // Prepare staff data for PDF
    const staffData = {
      ...staffMember.toObject(),
      reportingToName: staffMember.reportingTo?.fullName || 'Abhishek Rana (Training Head)'
    };

    // Generate PDF
    const doc = generateOfferLetterPDF(staffData);
    const pdfBuffer = doc.output('arraybuffer');

    // Send email with PDF attachment
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.GMAIL_USER || 'your-email@gmail.com',
      to: staffMember.email,
      subject: 'Offer Letter - Wipronix Technologies Pvt. Ltd.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Welcome to Wipronix Technologies Pvt. Ltd.</h2>
          <p>Dear ${staffMember.fullName},</p>
          <p>Please find attached your official Offer Letter.</p>
          <p>This offer is subject to the terms and conditions mentioned in the letter.</p>
          <p>Please sign and return a copy of this letter as acceptance of the offer.</p>
          <br/>
          <p>Best regards,</p>
          <p>HR Department</p>
          <p>Wipronix Technologies Pvt. Ltd.</p>
          <p>Contact: 9646706113</p>
        </div>
      `,
      attachments: [
        {
          filename: `OfferLetter_${staffMember.fullName.replace(/\s+/g, '_')}.pdf`,
          content: Buffer.from(pdfBuffer)
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    // Update staff document to mark offer letter as sent
    staffMember.documents.offerLetterSent = true;
    staffMember.documents.offerLetterSentDate = new Date();
    await staffMember.save();

    return res.status(200).json({
      success: true,
      message: 'Offer letter sent successfully to ' + staffMember.email
    });

  } catch (error) {
    console.error('Error sending offer letter:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send offer letter'
    });
  }
};

module.exports = { sendOfferLetter };


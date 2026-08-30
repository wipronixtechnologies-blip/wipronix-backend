const Staff = require('../../models/Staff.model');
const nodemailer = require('nodemailer');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
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

// Generate offer letter PDF content using pdf-lib and Letterhead.pdf template
const generateOfferLetterPDF = async (staffData) => {
  const letterheadPath = path.join(__dirname, '../../assets', 'Letterhead.pdf');
  if (!fs.existsSync(letterheadPath)) {
    throw new Error('Letterhead template not found');
  }
  const letterheadBytes = fs.readFileSync(letterheadPath);

  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.5; // A4 width in pt
  const pageHeight = 841.92; // A4 height in pt

  const addPageWithLetterhead = async () => {
    const [letterheadPage] = await pdfDoc.embedPdf(letterheadBytes);
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawPage(letterheadPage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
    return page;
  };

  let page = await addPageWithLetterhead();
  const margin = 60;
  const topMargin = 160; // Leave space for header logo/address
  const bottomMargin = 100; // Leave space for footer
  let currentY = pageHeight - topMargin;

  const drawText = async (text, options = {}) => {
    const { size = 10, color = rgb(0, 0, 0), isBullet = false, indent = 0, lineSpacing = 4, isHeader = false } = options;
    const fontSize = isHeader ? size + 1.5 : size;
    const xPos = margin + indent + (isBullet ? 20 : 0);
    const maxWidth = pageWidth - margin - xPos;

    if (isBullet) {
      page.drawText('•', { x: margin + indent + 8, y: currentY, size: fontSize, font: helveticaFont, color });
    }

    const segments = [];
    const parts = text.split(/(\*\*.*?\*\*)/g);
    for (const part of parts) {
      if (part === '') continue;
      if (part.startsWith('**') && part.endsWith('**')) {
        segments.push({ text: part.slice(2, -2), font: helveticaBoldFont });
      } else {
        segments.push({ text: part, font: helveticaFont });
      }
    }

    let lines = [];
    let currentLineBuild = [];
    let currentLineWidth = 0;

    for (const segment of segments) {
      const words = segment.text.split(/(\s+)/);
      for (const word of words) {
        const wordWidth = segment.font.widthOfTextAtSize(word, fontSize);
        if (currentLineWidth + wordWidth > maxWidth && word.trim() !== '') {
          lines.push(currentLineBuild);
          currentLineBuild = [];
          currentLineWidth = 0;
          if (word === ' ') continue;
        }
        currentLineBuild.push({ text: word, font: segment.font });
        currentLineWidth += wordWidth;
      }
    }
    if (currentLineBuild.length > 0) lines.push(currentLineBuild);

    for (const line of lines) {
      if (currentY < bottomMargin) {
        page = await addPageWithLetterhead();
        currentY = pageHeight - topMargin;
      }
      let xOffset = xPos;
      for (const seg of line) {
        page.drawText(seg.text, { x: xOffset, y: currentY, size: fontSize, font: seg.font, color });
        xOffset += seg.font.widthOfTextAtSize(seg.text, fontSize);
      }
      currentY -= fontSize + lineSpacing;
    }
    currentY -= lineSpacing;
  };

  const drawLine = () => {
    if (currentY < bottomMargin) return;
    page.drawLine({
      start: { x: margin, y: currentY + 5 },
      end: { x: pageWidth - margin, y: currentY + 5 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    currentY -= 15;
  };

  // Header info (Reference number and Date)
  page.drawText('WIP/HR/2026/006', { x: pageWidth - 160, y: pageHeight - 130, size: 10, font: helveticaBoldFont });
  page.drawText(`Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, { x: pageWidth - 160, y: pageHeight - 142, size: 9, font: helveticaFont });

  // Salutation
  await drawText(`Dear **${staffData.fullName}**,`);
  currentY -= 10;

  // Intro paragraph
  const designation = staffData.designation || 'BDE';
  const department = staffData.department || 'Marketing';
  const isIntern = staffData.employeeType === 'intern' || designation.toLowerCase().includes('intern') || designation.toLowerCase().includes('apprentice');

  // Salutation
  await drawText(`Dear **${staffData.fullName}**,`);
  currentY -= 10;

  // Intro paragraph
  if (isIntern) {
    await drawText(`We are pleased to offer you an Internship / Apprenticeship with **Wipronix Technologies Pvt. Ltd.** for the position of **${designation}** in the **${department}** department, subject to the terms and conditions outlined below.`);
  } else {
    await drawText(`We are pleased to offer you employment with **Wipronix Technologies Pvt. Ltd.** for the position of **${designation}** in the **${department}** department, subject to the terms and conditions outlined below.`);
  }
  currentY -= 10;

  // 1. Appointment & Reporting
  await drawText('**1. Appointment & Reporting**', { isHeader: true });
  const reportingTo = staffData.reportingToName || 'Abhishek Rana (Training Head)';
  if (isIntern) {
    await drawText(`You are engaged as an **Intern / Apprentice (${designation})** and will report to **${reportingTo}** or any other person as assigned by the management from time to time.`, { indent: 10 });
  } else {
    await drawText(`You are appointed as **${designation}** and will report to **${reportingTo}** or any other person as assigned by the management from time to time.`, { indent: 10 });
  }
  currentY -= 10;

  // 2. Date of Joining
  await drawText('**2. Date of Joining**', { isHeader: true });
  const joiningDate = staffData.dateOfJoining 
    ? new Date(staffData.dateOfJoining).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (isIntern) {
    await drawText(`Your engagement shall commence on **${joiningDate}**. You are required to report at the office and complete all joining formalities on this date.`, { indent: 10 });
  } else {
    await drawText(`Your employment shall commence on **${joiningDate}**. You are required to report at the office and complete all joining formalities on this date.`, { indent: 10 });
  }
  currentY -= 10;

  // 3. Nature of Engagement / Employment
  if (isIntern) {
    await drawText('**3. Nature of Engagement**', { isHeader: true });
    await drawText(`This engagement shall be an **Internship / Apprenticeship**. The duration of this engagement shall be for a period of three (3) months (or as specified in your joining details) from the date of joining. Upon successful completion of this period and based on your performance, you may be considered for a permanent role at the sole discretion of management.`, { indent: 10 });
  } else {
    await drawText('**3. Nature of Employment & Probation**', { isHeader: true });
    const empType = staffData.employeeType === 'full_time' ? 'Full-time' : 
                    staffData.employeeType === 'part_time' ? 'Part-time' :
                    staffData.employeeType === 'contract' ? 'Contract' : 'Intern';
    await drawText(`This employment shall be **${empType}**. You will be on probation for a period of three (3) months from the date of joining. Upon satisfactory completion of probation, your employment may be confirmed at the sole discretion of management.`, { indent: 10 });
  }
  currentY -= 10;

  // 4. Roles & Responsibilities
  await drawText('**4. Roles & Responsibilities**', { isHeader: true });
  await drawText('Your duties shall include responsibilities assigned to your role and any other tasks entrusted to you in the interest of the organization. You are expected to perform your duties with integrity, diligence, and professionalism.', { indent: 10 });
  currentY -= 10;

  // 5. Compensation / Stipend Structure
  const salary = staffData.salaryStructure?.baseSalary || 15000;
  if (isIntern) {
    await drawText('**5. Stipend Structure**', { isHeader: true });
    await drawText(`You shall be paid a consolidated stipend of **INR ${salary.toLocaleString()}/- per month**, subject to statutory deductions as applicable, payable as per company policy.`, { indent: 10 });
  } else {
    await drawText('**5. Compensation Structure**', { isHeader: true });
    await drawText('**a) Fixed Compensation**', { indent: 10 });
    await drawText(`You shall be paid a consolidated salary of **INR ${salary.toLocaleString()}/- per month**, subject to statutory deductions, payable as per company payroll policy.`, { indent: 15 });
    currentY -= 5;
    await drawText('**b) Performance-Based Incentives**', { indent: 10 });
    await drawText('You may be eligible for performance-linked incentives as per applicable company policies, based strictly on measurable performance parameters.', { indent: 15 });
    currentY -= 5;
    await drawText('**c) Retention Bonus**', { indent: 10 });
    await drawText('A Retention Bonus of INR [Amount]/- shall be payable upon successful completion of 12 months of continuous service with satisfactory performance. This bonus shall stand forfeited in the event of resignation or termination prior to completion of the retention period.', { indent: 15 });
  }
  currentY -= 10;

  // 6. Confidentiality & Intellectual Property
  await drawText('**6. Confidentiality & Intellectual Property**', { isHeader: true });
  await drawText('You shall maintain strict confidentiality of all business information, client data, intellectual property, and internal processes during and after your engagement with the company.', { indent: 10 });
  currentY -= 10;

  // 7. Code of Conduct
  await drawText('**7. Code of Conduct**', { isHeader: true });
  await drawText('You shall comply with all company policies, rules, and professional standards as amended from time to time.', { indent: 10 });
  currentY -= 10;

  // 8. Termination
  await drawText('**8. Termination**', { isHeader: true });
  if (isIntern) {
    await drawText('During this engagement, either party may terminate this internship by providing 7 days\' written notice. The company reserves the right to terminate your engagement without notice in cases of misconduct or policy violation.', { indent: 10 });
  } else {
    await drawText('During the probation period, either party may terminate this employment by providing 15 days\' written notice. The company reserves the right to terminate employment without notice in cases of misconduct, policy violation, or breach of trust.', { indent: 10 });
  }
  currentY -= 10;

  // 9. Acceptance
  await drawText('**9. Acceptance**', { isHeader: true });
  await drawText('Please sign and return a copy of this letter as acceptance of the offer. This offer shall be deemed null and void if you fail to join on the specified date.', { indent: 10 });
  currentY -= 15;

  // Closing
  await drawText('We welcome you to Wipronix Technologies Pvt. Ltd. and look forward to a professional association.');
  currentY -= 15;
  await drawText('Warm regards,');
  await drawText('**For Wipronix Technologies Pvt. Ltd.**');
  currentY -= 20; // Space for signature
  await drawText('**Harish Chawla**');
  await drawText('CEO');
  await drawText('Contact: 9646706113');

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
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
    const pdfBuffer = await generateOfferLetterPDF(staffData);

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


const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const Staff = require('../../models/Staff.model');

const generateOfferLetterPDF = async (staffId, options = {}) => {
    // Populating reportingTo to get the manager's name
    const staff = await Staff.findById(staffId).populate('reportingTo');

    if (!staff) {
        throw new Error('Staff not found');
    }

    const { signingName = 'Harish Chawla', signingDesignation = 'CEO' } = options;

    // Load letterhead
    const letterheadPath = path.join(__dirname, '..', '..', 'assets', 'Letterhead.pdf');
    
    if (!fs.existsSync(letterheadPath)) {
        console.error('Letterhead not found at:', letterheadPath);
        throw new Error('Letterhead file not found on server');
    }
    
    const letterheadBytes = fs.readFileSync(letterheadPath);
    
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.5;
    const pageHeight = 841.92;

    // Function to add a page with letterhead
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
    const topMargin = 160; 
    const bottomMargin = 120; // Increased bottom margin for better padding
    let currentY = pageHeight - topMargin;

    // Improved drawText that handles **bold** content and wrapping
    const drawText = async (text, options = {}) => {
        const { size = 10.5, color = rgb(0, 0, 0), isBullet = false, indent = 0, lineSpacing = 4, isHeader = false } = options;
        const fontSize = isHeader ? size + 2 : size;
        const xPos = margin + indent + (isBullet ? 20 : 0);
        const maxWidth = pageWidth - margin - xPos;

        if (isBullet) {
            page.drawText('•', { x: margin + indent + 8, y: currentY, size: fontSize, font: helveticaFont, color });
        }

        // Split text into segments based on **
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

        // Handle wrapping manually across segments
        let lines = [];
        let currentLineBuild = [];
        let currentLineWidth = 0;

        for (const segment of segments) {
            const words = segment.text.split(/(\s+)/); // Keep spaces
            for (const word of words) {
                const wordWidth = segment.font.widthOfTextAtSize(word, fontSize);
                if (currentLineWidth + wordWidth > maxWidth && word.trim() !== '') {
                    lines.push(currentLineBuild);
                    currentLineBuild = [];
                    currentLineWidth = 0;
                    if (word === ' ') continue; // Skip leading space on new line
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
        currentY -= lineSpacing; // extra gap after paragraph
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

    // --- Data Preparation ---
    const candidateName = `**${staff.fullName || ''}**`;
    const designation = `**${staff.designation || 'Specialist'}**`;
    const department = `**${staff.department || 'Operations'}**`;
    const companyName = `**Wipronix Technologies Pvt. Ltd.**`;
    
    let managerName = `**HR Department**`;
    if (staff.reportingTo) {
        const mgrRole = staff.reportingTo.designation || 'Manager';
        const displayRole = mgrRole.toLowerCase().includes('admin') ? 'HR Manager' : mgrRole;
        managerName = `**${staff.reportingTo.fullName} (${displayRole})**`;
    }
    
    const joiningDate = staff.dateOfJoining ? `**${new Date(staff.dateOfJoining).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}**` : `**[Joining Date]**`;
    const salaryAmount = `**INR ${(staff.salaryStructure?.baseSalary || 0).toLocaleString()}/- per month**`;
    
    let refNo = staff.offerReferenceNo;
    if (!refNo || refNo.trim() === '' || refNo.includes('___')) {
        const count = await Staff.countDocuments({ createdAt: { $lte: staff.createdAt } });
        refNo = `WIP/HR/2026/${String(count).padStart(3, '0')}`;
        staff.offerReferenceNo = refNo;
        await staff.save();
    }
    const refNoDisplay = `**${refNo}**`;
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const probationText = `**${staff.probationDuration || 'three (3) months'}**`;
    const retentionAmount = staff.retentionBonusAmount ? `**INR ${staff.retentionBonusAmount.toLocaleString()}/-**` : `**INR [Amount]/-**`;
    const retentionPeriod = `**${staff.retentionBonusPeriod || '12 months'}**`;
    const workMode = `**${staff.workMode || 'Office'}**`;
    const employmentNature = staff.employeeType === 'intern' ? '**Internship**' : (staff.employeeType === 'contract' ? '**Contractual**' : '**Full-time**');

    // --- Start Drawing Content ---
    await drawText(`${refNoDisplay}`, { bold: true });
    await drawText(`**Date:** ${today}`, { bold: true });
    currentY -= 15;

    await drawText(`Dear ${candidateName},`);
    await drawText(`We are pleased to offer you employment with ${companyName} for the position of ${designation} in the ${department}, subject to the terms and conditions outlined below.`);

    drawLine();
    await drawText(`1. Appointment & Reporting`, { isHeader: true });
    await drawText(`You are appointed as ${designation} and will report to ${managerName} or any other person as assigned by the management from time to time.`, { indent: 10 });

    drawLine();
    await drawText(`2. Date of Joining`, { isHeader: true });
    await drawText(`Your appointment shall commence on ${joiningDate}. You are required to report at ${workMode} and complete all joining formalities on this date.`, { indent: 10 });

    drawLine();
    await drawText(`3. Nature of Employment & Probation`, { isHeader: true });
    await drawText(`This employment shall be ${employmentNature}.`);
    await drawText(`You will be on probation for a period of ${probationText} from the date of joining. Upon satisfactory completion of probation, your employment may be confirmed at the sole discretion of management.`, { indent: 10 });

    drawLine();
    await drawText(`4. Roles & Responsibilities`, { isHeader: true });
    await drawText(`Your duties shall include responsibilities assigned to your role and any other tasks entrusted to you in the interest of the organization. You are expected to perform your duties with integrity, diligence, and professionalism.`, { indent: 10 });

    drawLine();
    await drawText(`5. Compensation Structure`, { isHeader: true });
    await drawText(`**a) Fixed Compensation**`);
    await drawText(`You shall be paid a consolidated salary of ${salaryAmount}, subject to statutory deductions, payable as per company payroll policy.`, { indent: 10 });
    
    await drawText(`**b) Performance-Based Incentives**`);
    await drawText(`You may be eligible for performance-linked incentives as per applicable company policies, based strictly on measurable performance parameters.`, { indent: 10 });

    await drawText(`**c) Retention Bonus**`);
    await drawText(`A **Retention Bonus of ${retentionAmount}** shall be payable upon successful completion of ${retentionPeriod} of continuous service with satisfactory performance.`, { indent: 10 });
    await drawText(`This bonus shall stand forfeited in the event of resignation or termination prior to completion of the retention period.`, { indent: 10 });

    drawLine();
    await drawText(`6. Confidentiality & Intellectual Property`, { isHeader: true });
    await drawText(`You shall maintain strict confidentiality of all business information, client data, intellectual property, and internal processes during and after your employment with the company.`, { indent: 10 });

    drawLine();
    await drawText(`7. Code of Conduct`, { isHeader: true });
    await drawText(`You shall comply with all company policies, rules, and professional standards as amended from time to time.`, { indent: 10 });

    drawLine();
    await drawText(`8. Termination`, { isHeader: true });
    await drawText(`During the probation period, either party may terminate this employment by providing **15 days’ written notice**.`);
    await drawText(`The company reserves the right to terminate employment without notice in cases of misconduct, policy violation, or breach of trust.`, { indent: 10 });

    drawLine();
    await drawText(`9. Acceptance`, { isHeader: true });
    await drawText(`Please sign and return a copy of this letter as acceptance of the offer. This offer shall be deemed null and void if you fail to join on the specified date.`, { indent: 10 });

    await drawText(`We welcome you to ${companyName} and look forward to a professional association.`);

    currentY -= 30; // Increased spacing for Warm regards
    await drawText(`Warm regards,`);
    currentY -= 10;
    await drawText(`For ${companyName}`, { bold: true });
    
    // Signature Info
    await drawText(`**${signingName}**`);
    await drawText(`**${signingDesignation}**`);
    if (signingName === 'Harish Chawla') {
        await drawText(`**Contact: 9646706113**`);
    } else if (signingName === 'Abhay Rana') {
        await drawText(`**Contact: 9876543210**`); // Assuming a number, can be adjusted
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
};

const generateOfferLetter = async (req, res) => {
  try {
    const { id } = req.params;
    const { signingName, signingDesignation } = req.query;
    
    const pdfBuffer = await generateOfferLetterPDF(id, { signingName, signingDesignation });

    // Get staff for filename
    const staff = await Staff.findById(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Offer_Letter_${(staff?.fullName || '').replace(/\s+/g, '_')}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating offer letter:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error while generating PDF' });
  }
};

module.exports = { generateOfferLetter, generateOfferLetterPDF };

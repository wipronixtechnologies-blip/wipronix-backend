const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const PlacementProposal = require('../../models/PlacementProposal.model');

const generateProposalPDF = async (proposalId) => {
    const proposal = await PlacementProposal.findById(proposalId).populate('college').populate('createdBy');

    if (!proposal) {
        throw new Error('Proposal not found');
    }

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
    const bottomMargin = 100;
    let currentY = pageHeight - topMargin;

    const drawText = async (text, options = {}) => {
        const { size = 11, color = rgb(0.1, 0.1, 0.1), indent = 0, lineSpacing = 5, isHeader = false, isBold = false } = options;
        const font = isBold || isHeader ? helveticaBoldFont : helveticaFont;
        const fontSize = isHeader ? size + 2 : size;
        const xPos = margin + indent;
        const maxWidth = pageWidth - margin - xPos;

        const words = text.split(' ');
        let line = '';
        const lines = [];

        for (const word of words) {
            const testLine = line + word + ' ';
            const width = font.widthOfTextAtSize(testLine, fontSize);
            if (width > maxWidth && line !== '') {
                lines.push(line);
                line = word + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        for (const line of lines) {
            if (currentY < bottomMargin) {
                page = await addPageWithLetterhead();
                currentY = pageHeight - topMargin;
            }
            page.drawText(line.trim(), {
                x: xPos,
                y: currentY,
                size: fontSize,
                font: font,
                color: color,
            });
            currentY -= fontSize + lineSpacing;
        }
        currentY -= lineSpacing;
    };

    const drawLine = () => {
        page.drawLine({
            start: { x: margin, y: currentY },
            end: { x: pageWidth - margin, y: currentY },
            thickness: 1,
            color: rgb(0.8, 0.1, 0.2), // Maroon-ish
        });
        currentY -= 20;
    };

    // --- Content ---
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    await drawText(`Date: ${today}`, { isBold: true });
    currentY -= 10;
    
    await drawText(`To,`, { isBold: true });
    await drawText(`The Training & Placement Officer,`);
    await drawText(`${proposal.college?.name || '[College Name]'}`);
    if (proposal.college?.location?.address) await drawText(`${proposal.college.location.address}`);
    await drawText(`${proposal.college?.location?.city || ''}, ${proposal.college?.location?.state || ''}`);
    currentY -= 20;

    await drawText(`Subject: Proposal for ${proposal.type} - ${proposal.title}`, { isBold: true, size: 12 });
    drawLine();

    await drawText(`Dear Sir/Madam,`, { isBold: true });
    currentY -= 5;

    await drawText(`We are pleased to submit our proposal for ${proposal.type} association with your esteemed institution. At Wipronix Technologies, we strive to bridge the gap between academia and industry by providing state-of-the-art training and placement opportunities.`);

    if (proposal.description) {
        currentY -= 5;
        await drawText(`Objective:`, { isBold: true });
        await drawText(proposal.description, { indent: 10 });
    }

    if (proposal.stipendSalary) {
        currentY -= 5;
        const rewardType = proposal.type === 'Internship' ? 'Stipend' : 'Salary Package';
        await drawText(`${rewardType}: ${proposal.stipendSalary}`, { isBold: true, color: rgb(0.1, 0.5, 0.1) });
    }

    // --- About Wipronix ---
    currentY -= 15;
    await drawText(`About Wipronix`, { isBold: true, size: 12, color: rgb(0.7, 0.1, 0.1) });
    await drawText(`Wipronix is a technology-driven organization focused on building industry-ready professionals through practical, project-based learning and real-world technology solutions. We bridge the gap between academic knowledge and industry expectations by enabling students to start working from Day 1.`);
    currentY -= 5;
    await drawText(`At Wipronix, we do not follow traditional training models. Instead, we offer internship-driven exposure, where interns work on live projects, real client requirements, and production-level systems under expert guidance.`);
    currentY -= 5;
    await drawText(`Our philosophy is simple: Learn. Grow. Lead.`, { isBold: true, indent: 10 });

    // --- Our Services ---
    currentY -= 15;
    await drawText(`Our Services`, { isBold: true, size: 12, color: rgb(0.7, 0.1, 0.1) });
    
    await drawText(`1. Web Development`, { isBold: true, indent: 5 });
    await drawText(`We design and develop responsive, secure, and scalable web applications using modern frameworks and industry best practices.`, { indent: 15 });
    
    await drawText(`2. App Development`, { isBold: true, indent: 5 });
    await drawText(`We build high-performance mobile and desktop applications aligned with real business and client needs.`, { indent: 15 });
    
    await drawText(`3. AI-Based Automation`, { isBold: true, indent: 5 });
    await drawText(`We implement AI and ML-driven automation solutions that optimize workflows, reduce manual tasks, and improve operational efficiency.`, { indent: 15 });
    
    await drawText(`4. Digital Marketing`, { isBold: true, indent: 5 });
    await drawText(`We deliver data-driven digital marketing solutions focused on visibility, growth, and performance through modern marketing tools and analytics.`, { indent: 15 });
    
    await drawText(`5. Business Analytics`, { isBold: true, indent: 5 });
    await drawText(`We help organizations and interns work with real datasets to generate insights, dashboards, and data-driven decision support systems.`, { indent: 15 });

    // --- Why Partner ---
    currentY -= 15;
    await drawText(`Why Partner with Wipronix for Placements`, { isBold: true, size: 12, color: rgb(0.7, 0.1, 0.1) });
    await drawText(`• Internship-first, project-driven approach`, { indent: 20 });
    await drawText(`• Real-world experience instead of classroom training`, { indent: 20 });
    await drawText(`• Industry-relevant skill development`, { indent: 20 });
    await drawText(`• Support for internships, assessments, and placement drives`, { indent: 20 });
    await drawText(`• Strong focus on employability from Day 1`, { indent: 20 });

    if (proposal.validUntil) {
        currentY -= 15;
        const validDate = new Date(proposal.validUntil).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        await drawText(`This proposal is valid until: ${validDate}`, { isBold: true, color: rgb(0.8, 0, 0) });
    }

    currentY -= 15;
    await drawText(`We look forward to a positive response and a long-term fruitful association with ${proposal.college?.name || 'your institution'}. For any further clarifications, please feel free to reach out to us.`);

    currentY -= 30;
    await drawText(`Warm regards,`);
    await drawText(`For Wipronix Technologies Pvt. Ltd.`, { isBold: true });
    
    currentY -= 20;
    const authorName = proposal.createdBy?.fullName || 'Manager';
    const authorRole = proposal.createdBy?.designation || 'Head of Department';
    
    await drawText(authorName, { isBold: true });
    await drawText(authorRole);
    await drawText(`Wipronix Technologies`);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
};

module.exports = { generateProposalPDF };

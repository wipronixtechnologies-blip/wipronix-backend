const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();
const Staff = require('./models/Staff.model');

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const staff = await Staff.findOne().populate('reportingTo');
        if (!staff) {
            console.log("No staff found");
            return;
        }

        const letterheadPath = path.join(__dirname, 'assets', 'Letterhead.pdf');
        if (!fs.existsSync(letterheadPath)) {
            console.log("Letterhead not found");
            return;
        }
        const letterheadBytes = fs.readFileSync(letterheadPath);

        const pdfDoc = await PDFDocument.create();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const pageWidth = 595.5;
        const pageHeight = 841.92;

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
            const { size = 10.5, color = rgb(0, 0, 0), isBullet = false, indent = 0, lineSpacing = 4, isHeader = false } = options;
            const fontSize = isHeader ? size + 2 : size;
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

        const candidateName = `**${staff.fullName || ''} ${staff.lastName || ''}**`;
        const jobTitle = `**${staff.designation || 'Specialist'}**`;
        const department = `**${staff.department || 'Operations'}**`;
        const companyName = `**Wipronix**`;
        const managerName = staff.reportingTo ? `**${staff.reportingTo.fullName} ${staff.reportingTo.lastName || ''}**` : `**Business Head**`;
        const joiningDate = staff.dateOfJoining ? `**${new Date(staff.dateOfJoining).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}**` : `**[To be Decided]**`;
        const salaryAmount = `**₹${(staff.salaryStructure?.baseSalary || 0).toLocaleString()}/- per month**`;

        console.log("Starting drawing...");
        await drawText(`Dear ${candidateName},`);
        await drawText(`We are pleased to offer you the position of ${jobTitle} in the ${department} at ${companyName}, based on your qualifications, skills, and interview performance.`);
        drawLine();
        await drawText(`### 1. Position & Reporting`, { isHeader: true });
        await drawText(`Designation: ${jobTitle}`, { indent: 10, isBullet: true });
        await drawText(`Department: ${department}`, { indent: 10, isBullet: true });
        await drawText(`Reporting To: ${managerName}`, { indent: 10, isBullet: true });
        drawLine();
        await drawText(`### 2. Date of Joining`, { isHeader: true });
        await drawText(`Your date of joining will be ${joiningDate}. You are required to report to **Wipronix Office / Remote** on this date and complete all joining formalities.`);
        drawLine();
        console.log("PDF generated successfully");
        const bytes = await pdfDoc.save();
        fs.writeFileSync('test_output.pdf', bytes);
        console.log("Saved to test_output.pdf");

    } catch (e) {
        console.error("FAILED:", e);
    } finally {
        mongoose.disconnect();
    }
}

test();

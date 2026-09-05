const Result = require("../../models/Result.model");
const Student = require("../../models/Student.model");
const nodemailer = require('nodemailer');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const QUALIFYING_MARKS = 70; // 70% passing threshold

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

const getTestResults = async (req, res, next) => {
  try {
    const {
      search,
      college,
      eventCode,
      status,
      isShortlisted,
      course,
      semester,
      technology,
      minPercentage,
      maxPercentage,
      startDate,
      endDate,
      testId,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (testId) query.testId = testId;
    if (eventCode) query.eventCode = eventCode.trim().toUpperCase();
    if (college) query.collegeName = new RegExp(college.trim(), 'i');
    if (course) query.course = new RegExp(course.trim(), 'i');
    if (semester) query.semester = new RegExp(semester.trim(), 'i');
    if (technology) query.technology = new RegExp(technology.trim(), 'i');
    if (isShortlisted === 'true') query.isShortlisted = true;

    if (minPercentage || maxPercentage) {
      query.percentage = {};
      if (minPercentage) query.percentage.$gte = parseFloat(minPercentage);
      if (maxPercentage) query.percentage.$lte = parseFloat(maxPercentage);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (status) {
      query.status = status.toUpperCase();
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { studentName: searchRegex },
        { studentEmail: searchRegex },
        { studentPhone: searchRegex },
        { collegeName: searchRegex },
        { eventCode: searchRegex },
        { course: searchRegex },
        { semester: searchRegex },
        { technology: searchRegex }
      ];
    }

    const pageNum = parseInt(page) || 1;
    const isNoLimit = limit === 'all' || limit === '0' || limit === 0 || limit === '-1' || Number(limit) === 0;
    const limitNum = isNoLimit ? 0 : (parseInt(limit) || 20);
    const skip = isNoLimit ? 0 : (pageNum - 1) * limitNum;

    // Build query execution excluding heavy answers field and populating student profile
    let queryExec = Result.find(query)
      .select('-answers')
      .populate('studentId', 'course semester technology education')
      .sort({ createdAt: -1 });

    if (!isNoLimit && limitNum > 0) {
      queryExec = queryExec.skip(skip).limit(limitNum);
    }

    // Execute queries in parallel for ultra-fast response times even with 500+ records
    const [results, totalCount, passedCount, avgScoreResult, rawColleges, rawEventCodes] = await Promise.all([
      queryExec.lean(),
      Result.countDocuments(query),
      Result.countDocuments({ ...query, status: 'PASS' }),
      Result.aggregate([
        { $match: query },
        { $group: { _id: null, avgPercentage: { $avg: '$percentage' } } }
      ]),
      Result.distinct('collegeName'),
      Result.distinct('eventCode')
    ]);

    const colleges = (rawColleges || []).filter(Boolean).sort();
    const eventCodes = (rawEventCodes || []).filter(Boolean).sort();

    // Map results cleanly with course, semester, technology
    const enrichedResults = results.map(result => {
      const percentage = result.percentage !== undefined 
        ? result.percentage 
        : (result.totalQuestions > 0 ? Math.round((result.correct / result.totalQuestions) * 100 * 10) / 10 : 0);

      const passStatus = result.status || (percentage >= QUALIFYING_MARKS ? 'PASS' : 'FAIL');

      const studentDoc = result.studentId && typeof result.studentId === 'object' ? result.studentId : {};
      let candidateCourse = result.course || studentDoc.course || studentDoc.education || '';
      let candidateSemester = result.semester || studentDoc.semester || '';
      let candidateTechnology = result.technology || studentDoc.technology || '';

      // If course was previously saved as "B.Tech - 6th Sem", split them cleanly
      if (candidateCourse && candidateCourse.includes(' - ')) {
        const parts = candidateCourse.split(' - ');
        candidateCourse = parts[0]?.trim() || candidateCourse;
        if (!candidateSemester && parts[1] && parts[1] !== 'Sem N/A') {
          candidateSemester = parts[1]?.trim();
        }
      }

      if (!candidateCourse) candidateCourse = 'B.Tech';
      if (!candidateSemester) candidateSemester = '6th Sem';
      if (!candidateTechnology) candidateTechnology = 'Core Technical';

      return {
        _id: result._id,
        studentId: studentDoc._id || result.studentId,
        studentName: result.studentName || 'Unknown',
        studentEmail: result.studentEmail || 'Unknown',
        studentPhone: result.studentPhone || 'N/A',
        college: result.collegeName || 'Not Specified',
        eventCode: result.eventCode || result.testId || 'N/A',
        course: candidateCourse,
        semester: candidateSemester,
        technology: candidateTechnology,
        testId: result.testId,
        totalQuestions: result.totalQuestions || 20,
        attempted: result.attempted || 0,
        correct: result.correct || 0,
        score: result.score || 0,
        percentage,
        status: passStatus,
        isShortlisted: Boolean(result.isShortlisted),
        isSelected: Boolean(result.isSelected),
        offerLetterSent: Boolean(result.offerLetterSent),
        offerLetterSentDate: result.offerLetterSentDate || null,
        technicalRoundMarks: result.technicalRoundMarks !== undefined ? result.technicalRoundMarks : (result.machineRoundScore !== undefined ? result.machineRoundScore : null),
        aiRoundMarks: result.aiRoundMarks !== undefined ? result.aiRoundMarks : null,
        screeningRoundMarks: result.screeningRoundMarks !== undefined ? result.screeningRoundMarks : null,
        hasMachineRound: Boolean(result.hasMachineRound),
        machineRoundStatus: result.machineRoundStatus || (result.hasMachineRound ? 'PENDING' : 'NOT_APPLICABLE'),
        machineRoundScore: result.machineRoundScore !== undefined ? result.machineRoundScore : (result.technicalRoundMarks !== undefined ? result.technicalRoundMarks : 0),
        machineRoundPassedTestCases: result.machineRoundPassedTestCases !== undefined ? result.machineRoundPassedTestCases : 0,
        machineRoundTotalTestCases: result.machineRoundTotalTestCases !== undefined ? result.machineRoundTotalTestCases : (result.hasMachineRound ? 5 : 0),
        machineRoundCode: result.machineRoundCode || '',
        machineRoundLanguage: result.machineRoundLanguage || 'javascript',
        machineRoundSubmittedAt: result.machineRoundSubmittedAt || null,
        machineRoundConsoleOutput: result.machineRoundConsoleOutput || '',
        machineRoundChallengeTitle: result.machineRoundChallengeTitle || '',
        createdAt: result.createdAt,
        updatedAt: result.updatedAt
      };
    });

    // In-memory search fallback (if needed)
    let filteredResults = enrichedResults;
    if (search && query.$or === undefined) {
      const searchLower = search.toLowerCase();
      filteredResults = filteredResults.filter(r =>
        r.studentName.toLowerCase().includes(searchLower) ||
        r.studentEmail.toLowerCase().includes(searchLower) ||
        r.studentPhone.toLowerCase().includes(searchLower) ||
        r.college.toLowerCase().includes(searchLower) ||
        r.eventCode.toLowerCase().includes(searchLower) ||
        (r.course && r.course.toLowerCase().includes(searchLower)) ||
        (r.semester && r.semester.toLowerCase().includes(searchLower))
      );
    }

    // Stats calculations
    const totalStudents = totalCount;
    const failedCount = totalStudents - passedCount;
    const averageScore = avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avgPercentage * 10) / 10 : 0;

    res.json({
      success: true,
      data: {
        results: filteredResults,
        stats: {
          total: totalStudents,
          passed: passedCount,
          failed: failedCount,
          passRate: totalStudents > 0 ? Math.round((passedCount / totalStudents) * 100 * 10) / 10 : 0,
          averageScore
        },
        colleges,
        eventCodes,
        pagination: {
          page: pageNum,
          limit: isNoLimit ? totalCount : limitNum,
          total: totalCount,
          totalPages: isNoLimit || limitNum === 0 ? 1 : Math.ceil(totalCount / limitNum)
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

// Toggle candidate shortlist status
const toggleShortlist = async (req, res, next) => {
  try {
    const { resultId, isShortlisted } = req.body;

    if (!resultId) {
      return res.status(400).json({
        success: false,
        message: "resultId is required"
      });
    }

    let updatedResult = null;

    // 1. Try finding by MongoDB Result _id
    try {
      updatedResult = await Result.findByIdAndUpdate(
        resultId,
        { isShortlisted: Boolean(isShortlisted) },
        { new: true }
      );
    } catch (e) {
      // Invalid ObjectId format
    }

    // 2. If not found by _id, search by studentId or email
    if (!updatedResult) {
      updatedResult = await Result.findOneAndUpdate(
        { $or: [{ studentId: resultId }, { studentEmail: resultId }] },
        { isShortlisted: Boolean(isShortlisted) },
        { new: true }
      );
    }

    if (!updatedResult) {
      return res.status(404).json({
        success: false,
        message: "Test result record not found"
      });
    }

    res.json({
      success: true,
      message: `Candidate ${isShortlisted ? 'shortlisted' : 'removed from shortlist'} successfully`,
      data: updatedResult
    });
  } catch (error) {
    console.error("Shortlist API Error:", error);
    next(error);
  }
};

// Update interview marks (Technical, AI, Screening)
const updateInterviewMarks = async (req, res, next) => {
  try {
    const { resultId, technicalRoundMarks, aiRoundMarks, screeningRoundMarks } = req.body;

    if (!resultId) {
      return res.status(400).json({
        success: false,
        message: "resultId is required"
      });
    }

    const updates = {};
    if (technicalRoundMarks !== undefined) {
      updates.technicalRoundMarks = technicalRoundMarks === "" || technicalRoundMarks === null ? null : Number(technicalRoundMarks);
    }
    if (aiRoundMarks !== undefined) {
      updates.aiRoundMarks = aiRoundMarks === "" || aiRoundMarks === null ? null : Number(aiRoundMarks);
    }
    if (screeningRoundMarks !== undefined) {
      updates.screeningRoundMarks = screeningRoundMarks === "" || screeningRoundMarks === null ? null : Number(screeningRoundMarks);
    }

    let updatedResult = null;

    try {
      updatedResult = await Result.findByIdAndUpdate(
        resultId,
        updates,
        { new: true }
      );
    } catch (e) {
      // Invalid ObjectId format
    }

    if (!updatedResult) {
      updatedResult = await Result.findOneAndUpdate(
        { $or: [{ studentId: resultId }, { studentEmail: resultId }] },
        updates,
        { new: true }
      );
    }

    if (!updatedResult) {
      return res.status(404).json({
        success: false,
        message: "Test result record not found"
      });
    }

    res.json({
      success: true,
      message: "Interview marks updated successfully",
      data: updatedResult
    });
  } catch (error) {
    console.error("Update Interview Marks API Error:", error);
    next(error);
  }
};

// Toggle selection status
const toggleSelection = async (req, res, next) => {
  try {
    const { resultId, isSelected } = req.body;

    if (!resultId) {
      return res.status(400).json({
        success: false,
        message: "resultId is required"
      });
    }

    let updatedResult = null;

    try {
      updatedResult = await Result.findByIdAndUpdate(
        resultId,
        { isSelected: Boolean(isSelected) },
        { new: true }
      );
    } catch (e) {
      // Invalid ObjectId format
    }

    if (!updatedResult) {
      updatedResult = await Result.findOneAndUpdate(
        { $or: [{ studentId: resultId }, { studentEmail: resultId }] },
        { isSelected: Boolean(isSelected) },
        { new: true }
      );
    }

    if (!updatedResult) {
      return res.status(404).json({
        success: false,
        message: "Test result record not found"
      });
    }

    res.json({
      success: true,
      message: `Candidate ${isSelected ? 'selected' : 'deselected'} successfully`,
      data: updatedResult
    });
  } catch (error) {
    console.error("Toggle Selection API Error:", error);
    next(error);
  }
};

// Send Student Offer Letter via email
const sendStudentOfferLetter = async (req, res, next) => {
  try {
    const { resultId } = req.body;

    if (!resultId) {
      return res.status(400).json({
        success: false,
        message: "resultId is required"
      });
    }

    const candidate = await Result.findById(resultId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate record not found"
      });
    }

    if (!candidate.isShortlisted || !candidate.isSelected) {
      return res.status(400).json({
        success: false,
        message: "Candidate must be shortlisted and selected to receive an offer letter"
      });
    }

    // Generate PDF
    const pdfBuffer = await generateStudentLetterPDF(candidate);

    // Send Email
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.GMAIL_USER || 'your-email@gmail.com',
      to: candidate.studentEmail,
      subject: 'Letter of Selection & Apprenticeship Offer - Wipronix Technologies',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
          <h2 style="color: #E52328;">Congratulations ${candidate.studentName}!</h2>
          <p>We are delighted to inform you that you have been selected for the <strong>Advanced Industrial Training & Apprenticeship Program</strong> at Wipronix Technologies.</p>
          <p>Please find attached your official <strong>Selection Offer Letter</strong> detailing the program structure, guidelines, and onboarding requirements.</p>
          <p>Please review the attachment and return a signed copy as acceptance within 3 days.</p>
          <br/>
          <p>Best regards,</p>
          <p><strong>Talent Acquisition Team</strong></p>
          <p>Wipronix Technologies Pvt. Ltd.</p>
          <p>Email: hr@wipronix.com | Contact: 9646706113</p>
        </div>
      `,
      attachments: [
        {
          filename: `Selection_Offer_Letter_${candidate.studentName.replace(/\s+/g, '_')}.pdf`,
          content: Buffer.from(pdfBuffer)
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    // Update document status
    candidate.offerLetterSent = true;
    candidate.offerLetterSentDate = new Date();
    await candidate.save();

    res.json({
      success: true,
      message: `Offer letter sent successfully to ${candidate.studentEmail}`,
      data: {
        offerLetterSent: true,
        offerLetterSentDate: candidate.offerLetterSentDate
      }
    });

  } catch (error) {
    console.error("Send Offer Letter API Error:", error);
    next(error);
  }
};

// Generate student selection letter PDF using pdf-lib and Letterhead.pdf
const generateStudentLetterPDF = async (candidate) => {
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

  // Reference and Date
  const refText = `Ref: WPR/OFFER/2026/${candidate._id.toString().slice(-5).toUpperCase()}`;
  const dateText = `Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  
  page.drawText(refText, { x: margin, y: pageHeight - 130, size: 10, font: helveticaBoldFont });
  page.drawText(dateText, { x: pageWidth - margin - 120, y: pageHeight - 130, size: 10, font: helveticaFont });

  currentY = pageHeight - 150;

  // Recipient info
  await drawText('To,');
  await drawText(`**${candidate.studentName}**`);
  await drawText(`College: ${candidate.collegeName || 'Not Specified'}`);
  await drawText(`Email: ${candidate.studentEmail}`);
  await drawText(`Mobile: ${candidate.studentPhone || 'N/A'}`);
  
  currentY -= 15;

  // Subject line (Centered or Bold Red)
  await drawText('**LETTER OF SELECTION & APPRENTICESHIP OFFER**', { color: rgb(0.9, 0.1, 0.1), size: 11 });
  
  currentY -= 10;

  // Salutation
  await drawText(`Dear **${candidate.studentName}**,`);
  currentY -= 10;

  // Body text
  await drawText('We are pleased to inform you that based on your exceptional performance in the National Talent Evaluation Campus Drive, and subsequent interview rounds, you have been selected for the **Advanced Industrial Training & Apprenticeship Program** at Wipronix.');
  
  currentY -= 10;

  // Performance summary
  await drawText('**Your Round Performance Summary:**', { isHeader: true });
  await drawText(`Online Test Score: **${candidate.percentage.toFixed(2)}%**`, { indent: 10, isBullet: true });
  await drawText(`Technical Interview: **${candidate.technicalRoundMarks !== null ? candidate.technicalRoundMarks : 'N/A'}**`, { indent: 10, isBullet: true });
  await drawText(`AI Interview Round: **${candidate.aiRoundMarks !== null ? candidate.aiRoundMarks : 'N/A'}**`, { indent: 10, isBullet: true });
  await drawText(`Screening/HR Round: **${candidate.screeningRoundMarks !== null ? candidate.screeningRoundMarks : 'N/A'}**`, { indent: 10, isBullet: true });

  currentY -= 15;

  await drawText('Program details, onboarding link, and other formalities will be shared with you shortly.');
  
  currentY -= 15;

  await drawText('Warm regards,');
  currentY -= 5;
  await drawText('**Talent Acquisition Team**');
  await drawText('**Wipronix Informatics Pvt. Ltd.**');

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
};

// Download Student Offer Letter PDF directly
const generateStudentOfferLetterDownload = async (req, res, next) => {
  try {
    const { resultId } = req.params;

    if (!resultId) {
      return res.status(400).json({
        success: false,
        message: "resultId is required"
      });
    }

    const candidate = await Result.findById(resultId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate record not found"
      });
    }

    // Generate PDF
    const pdfBytes = await generateStudentLetterPDF(candidate);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Selection_Offer_Letter_${candidate.studentName.replace(/\s+/g, '_')}.pdf`);
    return res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error("Download Offer Letter API Error:", error);
    next(error);
  }
};

// API to fetch ONLY shortlisted candidates
const getShortlistedStudents = async (req, res, next) => {
  req.query.isShortlisted = 'true';
  return getTestResults(req, res, next);
};

module.exports = { getTestResults, toggleShortlist, getShortlistedStudents, updateInterviewMarks, toggleSelection, sendStudentOfferLetter, generateStudentOfferLetterDownload };

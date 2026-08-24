const Result = require("../../models/Result.model");
const Student = require("../../models/Student.model");
const nodemailer = require('nodemailer');
const { jsPDF } = require('jspdf');

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
    if (isShortlisted === 'true') query.isShortlisted = true;


    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (status) {
      query.status = status.toUpperCase();
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Fetch results matching query
    let results = await Result.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await Result.countDocuments(query);

    // Get all unique colleges & event codes for filter dropdowns
    const allResults = await Result.find({}, { collegeName: 1, eventCode: 1 }).lean();
    const colleges = [...new Set(allResults.map(r => r.collegeName).filter(Boolean))].sort();
    const eventCodes = [...new Set(allResults.map(r => r.eventCode).filter(Boolean))].sort();

    // Map results cleanly
    const enrichedResults = results.map(result => {
      const percentage = result.percentage !== undefined 
        ? result.percentage 
        : (result.totalQuestions > 0 ? Math.round((result.correct / result.totalQuestions) * 100 * 10) / 10 : 0);

      const passStatus = result.status || (percentage >= QUALIFYING_MARKS ? 'PASS' : 'FAIL');

      return {
        _id: result._id,
        studentId: result.studentId,
        studentName: result.studentName || 'Unknown',
        studentEmail: result.studentEmail || 'Unknown',
        studentPhone: result.studentPhone || 'N/A',
        college: result.collegeName || 'Not Specified',
        eventCode: result.eventCode || result.testId || 'N/A',
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
        technicalRoundMarks: result.technicalRoundMarks !== undefined ? result.technicalRoundMarks : null,
        aiRoundMarks: result.aiRoundMarks !== undefined ? result.aiRoundMarks : null,
        screeningRoundMarks: result.screeningRoundMarks !== undefined ? result.screeningRoundMarks : null,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt
      };
    });

    // In-memory search if search query provided
    let filteredResults = enrichedResults;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredResults = filteredResults.filter(r =>
        r.studentName.toLowerCase().includes(searchLower) ||
        r.studentEmail.toLowerCase().includes(searchLower) ||
        r.studentPhone.toLowerCase().includes(searchLower) ||
        r.college.toLowerCase().includes(searchLower) ||
        r.eventCode.toLowerCase().includes(searchLower)
      );
    }

    // Stats calculations
    const totalStudents = totalCount;
    const passedCount = await Result.countDocuments({ ...query, status: 'PASS' });
    const failedCount = totalStudents - passedCount;
    const avgScoreResult = await Result.aggregate([
      { $match: query },
      { $group: { _id: null, avgPercentage: { $avg: '$percentage' } } }
    ]);
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
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
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
    const doc = generateStudentLetterPDF(candidate);
    const pdfBuffer = doc.output('arraybuffer');

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

// Generate student selection letter PDF
const generateStudentLetterPDF = (candidate) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(229, 35, 40); // Wipronix Red
  doc.text('WIPRONIX INFORMATICS', 14, 25);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Corporate Office: Dehradun & Mohali | Contact: info@wipronix.com', 14, 32);
  doc.line(14, 36, 196, 36);

  // Date and Reference
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Ref: WPR/OFFER/2026/${candidate._id.toString().slice(-5).toUpperCase()}`, 14, 48);
  doc.text(`Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, 150, 48);

  // Candidate Details
  doc.text(`To,`, 14, 62);
  doc.setFont('helvetica', 'bold');
  doc.text(`${candidate.studentName}`, 14, 70);
  doc.setFont('helvetica', 'normal');
  doc.text(`College: ${candidate.collegeName || 'Not Specified'}`, 14, 78);
  doc.text(`Email: ${candidate.studentEmail}`, 14, 86);
  doc.text(`Mobile: ${candidate.studentPhone || 'N/A'}`, 14, 94);

  // Subject
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(229, 35, 40);
  doc.text('LETTER OF SELECTION & APPRENTICESHIP OFFER', 14, 110);

  // Body
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50);
  doc.text(`Dear ${candidate.studentName},`, 14, 122);
  
  const introText = `We are pleased to inform you that based on your exceptional performance in the National Talent Evaluation Campus Drive, and subsequent interview rounds, you have been selected for the Advanced Industrial Training & Apprenticeship Program at Wipronix.`;
  doc.text(introText, 14, 132, { maxWidth: 180 });

  // Interview Scores Section
  let yPos = 160;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Your Round Performance Summary:', 14, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text(`- Online Test Score: ${candidate.percentage.toFixed(2)}%`, 20, yPos + 10);
  doc.text(`- Technical Interview: ${candidate.technicalRoundMarks || 'N/A'}`, 20, yPos + 18);
  doc.text(`- AI Interview Round: ${candidate.aiRoundMarks || 'N/A'}`, 20, yPos + 26);
  doc.text(`- Screening/HR Round: ${candidate.screeningRoundMarks || 'N/A'}`, 20, yPos + 34);

  yPos += 50;
  doc.setTextColor(50);
  doc.text('Program details, onboarding link, and other formalities will be shared with you shortly.', 14, yPos);
  
  yPos += 15;
  doc.text('Warm regards,', 14, yPos);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Talent Acquisition Team', 14, yPos + 10);
  doc.text('Wipronix Informatics Pvt. Ltd.', 14, yPos + 18);

  // Footer on each page
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('www.wipronix.com | hr@wipronix.com | 9646706113', doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: 'center' });

  return doc;
};

// API to fetch ONLY shortlisted candidates
const getShortlistedStudents = async (req, res, next) => {
  req.query.isShortlisted = 'true';
  return getTestResults(req, res, next);
};

module.exports = { getTestResults, toggleShortlist, getShortlistedStudents, updateInterviewMarks, toggleSelection, sendStudentOfferLetter };

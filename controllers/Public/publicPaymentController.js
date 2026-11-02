const QRCode = require('qrcode');
const fs = require('fs');
const RegistrationSlip = require('../../models/RegistrationSlip.model');
const Student = require('../../models/Student.model');
const Staff = require('../../models/Staff.model');
const { uploadBuffer } = require('../../src/services/cloudinaryService');
const { logActivity } = require('../Activity/activityController');

const UPI_ID = process.env.UPI_ID || process.env.UPI_VPA || 'harish75.chawla-3@oksbi';
const UPI_NAME = process.env.UPI_PAYEE_NAME || 'Harish Chawla';

/**
 * GET /api/public/registration-pay/:token
 * Public endpoint to fetch locked payment & student information using the secure token
 */
exports.getPaymentPortalData = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing payment token.'
      });
    }

    // Lookup registration slip by paymentToken
    const slip = await RegistrationSlip.findOne({ paymentToken: token.trim() })
      .populate('student', 'fullName email phoneNumber college course degree semester admissionTechnology admissionFee leadStage counselingStatus')
      .populate('issuedBy', 'fullName role systemRole designation department');

    if (!slip) {
      return res.status(404).json({
        success: false,
        message: 'Payment link not found or has expired. Please contact your counselor.'
      });
    }

    // Check token expiration
    if (slip.tokenExpiresAt && new Date(slip.tokenExpiresAt) < new Date()) {
      return res.status(410).json({
        success: false,
        isExpired: true,
        message: 'This payment link has expired. Please contact your counselor for a fresh payment link.'
      });
    }

    // Generate or use existing dynamic UPI string
    const registrationNo = slip.registrationNo;
    const amount = Number(slip.paidAmount) || 0;
    const upiString = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(registrationNo)}`;

    let qrDataUrl = slip.qrDataUrl;
    if (!qrDataUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(upiString, { width: 360, margin: 2 });
      } catch (qrErr) {
        console.error('Error generating QR Data URL:', qrErr);
      }
    }

    // Return ONLY safe, read-only fields
    const counselorName = slip.issuedBy ? slip.issuedBy.fullName : 'Counselor';
    const studentData = slip.student || {};

    return res.status(200).json({
      success: true,
      data: {
        registrationNo: slip.registrationNo,
        studentName: studentData.fullName || 'Student',
        email: studentData.email || '',
        college: studentData.college || '',
        technology: slip.technology,
        duration: slip.duration || '6 Months',
        totalFee: slip.totalFee,
        discountAmount: slip.discountAmount || 0,
        discountType: slip.discountType || '',
        netFee: slip.netFee !== null && slip.netFee !== undefined ? slip.netFee : Math.max(0, Number(slip.totalFee || 0) - Number(slip.discountAmount || 0)),
        payableAmount: slip.paidAmount, // The exact registration amount locked
        dueAmount: slip.dueAmount,
        counselorName,
        status: slip.status,
        upiId: UPI_ID,
        payeeName: UPI_NAME,
        upiString,
        qrDataUrl,
        tokenExpiresAt: slip.tokenExpiresAt,
        isExpired: false,
        isAlreadySubmitted: ['Proof Submitted', 'Verified', 'Paid'].includes(slip.status),
        transactionId: slip.transactionId || null,
        paymentScreenshotUrl: slip.paymentScreenshotUrl || null,
        studentSubmissionDate: slip.studentSubmissionDate || null,
        rejectionReason: slip.rejectionReason || null
      }
    });

  } catch (error) {
    console.error('Error fetching payment portal data:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve payment session details. Please try again later.'
    });
  }
};

/**
 * POST /api/public/registration-pay/:token/submit
 * Public endpoint to submit UTR / Transaction ID and payment screenshot
 */
exports.submitPaymentProof = async (req, res) => {
  try {
    const { token } = req.params;
    const { transactionId } = req.body;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment session.'
      });
    }

    // Lookup slip
    const slip = await RegistrationSlip.findOne({ paymentToken: token.trim() })
      .populate('student', 'fullName email phoneNumber');

    if (!slip) {
      return res.status(404).json({
        success: false,
        message: 'Payment session not found or invalid.'
      });
    }

    // Check expiration
    if (slip.tokenExpiresAt && new Date(slip.tokenExpiresAt) < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'This payment link has expired. Please contact your counselor.'
      });
    }

    // Prevent double submission if already verified/paid
    if (slip.status === 'Verified' || slip.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment for this registration has already been verified and processed.'
      });
    }

    // Validate UTR
    if (!transactionId || typeof transactionId !== 'string' || transactionId.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Bank Transaction ID / UTR number (at least 6 characters).'
      });
    }

    // Validate Screenshot file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload the payment confirmation screenshot.'
      });
    }

    // Upload screenshot to Cloudinary with fallback
    let screenshotUrl = '';
    try {
      const uploadResult = await uploadBuffer(req.file.buffer, {
        folder: 'wipronix-payment-proofs',
        resource_type: 'auto'
      });
      screenshotUrl = uploadResult?.secure_url || uploadResult?.url || '';
    } catch (uploadErr) {
      console.warn('Cloudinary upload failed, falling back to data URI:', uploadErr.message);
      // Fallback: embed small data URI or local storage if Cloudinary fails
      const base64Data = req.file.buffer.toString('base64');
      screenshotUrl = `data:${req.file.mimetype};base64,${base64Data}`;
    }

    const cleanUTR = transactionId.trim().toUpperCase();

    // Update slip
    slip.transactionId = cleanUTR;
    slip.paymentScreenshotUrl = screenshotUrl;
    slip.studentSubmissionDate = new Date();
    slip.status = 'Proof Submitted';
    slip.rejectionReason = ''; // Clear previous rejection if re-submitting
    await slip.save();

    // Log Activity
    try {
      await logActivity({
        type: 'payment_proof_submitted',
        category: 'finance',
        user: slip.student?.fullName || 'Student',
        actorId: slip.student?._id,
        actorRole: 'student',
        action: `Submitted payment proof for registration ${slip.registrationNo} (UTR: ${cleanUTR}, Amount: ₹${slip.paidAmount})`,
        target: slip.student?.fullName || 'Student',
        targetId: slip.student?._id,
        targetModel: 'Student',
        metadata: {
          registrationNo: slip.registrationNo,
          transactionId: cleanUTR,
          paidAmount: slip.paidAmount
        }
      });
    } catch (actErr) {
      console.error('Error logging payment proof activity:', actErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment proof submitted successfully! Your counselor will verify your transaction shortly.',
      data: {
        registrationNo: slip.registrationNo,
        transactionId: cleanUTR,
        status: slip.status,
        studentSubmissionDate: slip.studentSubmissionDate
      }
    });

  } catch (error) {
    console.error('Error submitting payment proof:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while submitting payment proof. Please try again.'
    });
  }
};

/**
 * GET /api/public/receipt/:registrationNo
 * Stream or download official tamper-proof PDF receipt directly for student on WhatsApp
 */
exports.downloadPublicReceiptPdf = async (req, res) => {
  try {
    const { registrationNo } = req.params;
    if (!registrationNo) {
      return res.status(400).send('Registration number is required.');
    }

    const slip = await RegistrationSlip.findOne({ registrationNo }).populate('student');
    if (!slip) {
      return res.status(404).send('Registration receipt not found.');
    }

    const receiptService = require('../../src/services/receiptService');
    let filePath = receiptService.getReceiptPdfPath(slip.registrationNo);
    let pdfBuffer = null;

    if (filePath && fs.existsSync(filePath)) {
      pdfBuffer = fs.readFileSync(filePath);
    } else {
      const generated = await receiptService.generateAndSaveReceipt(slip, slip.student || {});
      pdfBuffer = generated.pdfBuffer;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Wipronix_Registration_Receipt_${slip.registrationNo}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error serving public receipt PDF:', error);
    return res.status(500).send('Unable to generate or fetch receipt PDF.');
  }
};


/**
 * GET /api/public/receipt-details/:registrationNo
 * Retrieve public verification metadata for the official student receipt page
 */
exports.getPublicReceiptDetails = async (req, res) => {
  try {
    const { registrationNo } = req.params;
    if (!registrationNo) {
      return res.status(400).json({ success: false, message: 'Registration number is required.' });
    }

    const slip = await RegistrationSlip.findOne({ registrationNo }).populate('student');
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Registration receipt not found.' });
    }

    const studentObj = slip.student || {};
    const isCash = (slip.paymentMode || '').toLowerCase().includes('cash') || slip.transactionId === 'CASH-PAYMENT';

    return res.status(200).json({
      success: true,
      data: {
        registrationNo: slip.registrationNo,
        studentName: studentObj.fullName || slip.studentName || 'Student',
        email: studentObj.email || slip.email || '',
        phoneNumber: studentObj.phoneNumber || slip.phoneNumber || '',
        college: studentObj.college || slip.college || 'DAV Institute of Engineering and Technology',
        technology: slip.registeredTechnology || slip.technology || 'Training Program',
        duration: slip.duration || '6 Months',
        installmentNumber: slip.installmentNumber || 1,
        totalFee: Number(slip.totalFee || 25000),
        discountAmount: Number(slip.discountAmount || 0),
        discountType: slip.discountType || '',
        netFee: Number(slip.totalFee || 25000) - Number(slip.discountAmount || 0),
        paidAmount: Number(slip.paidAmount || 0),
        dueAmount: Number(slip.dueAmount || 0),
        paymentMode: isCash ? 'Cash (In-Office)' : (slip.paymentMode || slip.mode || 'Online QR'),
        transactionId: isCash ? 'CASH-PAYMENT' : (slip.transactionId || ''),
        status: slip.status || 'Verified',
        date: slip.verifiedAt || slip.studentSubmissionDate || slip.createdAt,
        verifiedByName: slip.verifiedByName || 'Superadmin'
      }
    });
  } catch (error) {
    console.error('Error fetching public receipt details:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch receipt details.' });
  }
};

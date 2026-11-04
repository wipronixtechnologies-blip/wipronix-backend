const FeePayment = require('../../models/FeePayment.model');
const Student = require('../../models/Student.model');
const RegistrationSlip = require('../../models/RegistrationSlip.model');
const receiptService = require('../../src/services/receiptService');
const msgStudio = require('../../src/services/msgStudioService');

// Get all unified payments & receipt transactions
exports.getAllPayments = async (req, res) => {
  try {
    const { search, mode, track } = req.query;

    const slips = await RegistrationSlip.find()
      .populate('student', 'fullName email phoneNumber college course semester registeredTechnology admissionTechnology technology')
      .populate('issuedBy', 'fullName firstName lastName email role')
      .populate('verifiedBy', 'fullName firstName lastName email role')
      .sort({ createdAt: -1 });

    const feePayments = await FeePayment.find()
      .populate('student', 'fullName email phoneNumber college')
      .populate('collectedBy', 'fullName email')
      .sort({ createdAt: -1 });

    const unifiedPayments = [];

    slips.forEach(s => {
      const isCash = (s.paymentMode || '').toLowerCase().includes('cash') || s.transactionId === 'CASH-PAYMENT';
      unifiedPayments.push({
        _id: s._id,
        slipId: s._id,
        registrationNo: s.registrationNo,
        student: s.student ? {
          _id: s.student._id,
          fullName: s.student.fullName || s.studentName,
          email: s.student.email || s.email,
          phoneNumber: s.student.phoneNumber || s.phoneNumber,
          college: s.student.college || s.college || 'DAV Institute of Engineering and Technology'
        } : {
          fullName: s.studentName || 'Student',
          email: s.email || '',
          phoneNumber: s.phoneNumber || '',
          college: s.college || ''
        },
        amount: Number(s.paidAmount || 0),
        paidAmount: Number(s.paidAmount || 0),
        totalFee: Number(s.totalFee || 25000),
        discountAmount: Number(s.discountAmount || 0),
        discountType: s.discountType || '',
        dueAmount: Number(s.dueAmount || 0),
        type: s.installmentNumber === 1 ? 'Registration Fee' : `Installment #${s.installmentNumber}`,
        installmentNumber: s.installmentNumber || 1,
        technology: s.registeredTechnology || s.technology || 'Core Training Track',
        duration: s.duration || '6 Months',
        paymentMode: isCash ? 'Cash (In-Office)' : (s.paymentMode || s.mode || 'Online QR'),
        transactionId: isCash ? 'CASH-PAYMENT' : (s.transactionId || ''),
        paymentScreenshotUrl: s.paymentScreenshotUrl,
        pdfUrl: s.pdfUrl,
        status: s.status || 'Pending Verification',
        verifiedByName: s.verifiedByName,
        verifiedAt: s.verifiedAt,
        collectedBy: s.issuedBy?.fullName || s.issuedBy?.firstName || 'Counselor / Office',
        createdAt: s.studentSubmissionDate || s.createdAt
      });
    });

    feePayments.forEach(f => {
      unifiedPayments.push({
        _id: f._id,
        registrationNo: f.receiptNumber || f.transactionId || `PAY-${f._id.toString().slice(-6).toUpperCase()}`,
        student: f.student,
        amount: Number(f.amount || 0),
        paidAmount: Number(f.amount || 0),
        type: f.type || 'Direct Fee Payment',
        installmentNumber: null,
        technology: f.course || 'Core Training Track',
        duration: '6 Months',
        totalFee: Number(f.totalFee || f.amount || 0),
        discountAmount: 0,
        discountType: '',
        dueAmount: 0,
        paymentMode: f.paymentMode || 'Online',
        transactionId: f.transactionId || '',
        status: f.status || 'Paid',
        collectedBy: f.collectedBy?.fullName || 'Staff',
        createdAt: f.createdAt
      });
    });

    unifiedPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({
      success: true,
      data: unifiedPayments
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

// Add new payment
exports.addPayment = async (req, res) => {
  try {
    const payment = new FeePayment({
      ...req.body,
      collectedBy: req.staff._id
    });
    await payment.save();
    res.status(201).json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  }
};

// Get Comprehensive Finance & Revenue Stats with Program/Track Visual Charts
exports.getFinanceStats = async (req, res) => {
  try {
    const verifiedSlips = await RegistrationSlip.find({
      status: { $in: ['Verified', 'Paid'] }
    }).populate('student', 'fullName email phoneNumber college registeredTechnology admissionTechnology technology totalFee totalPaidFee dueAmount discountAmount discountType leadStage isRegistrationVerified');

    const allSlips = await RegistrationSlip.find();
    const feePayments = await FeePayment.find({ status: 'Paid' });

    // Calculate total verified collected revenue
    const slipRevenue = verifiedSlips.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
    const feeRevenue = feePayments.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    const totalRevenue = slipRevenue + feeRevenue;

    // Today's collection
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todaySlipRevenue = verifiedSlips
      .filter(s => new Date(s.verifiedAt || s.studentSubmissionDate || s.createdAt) >= startOfToday)
      .reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);

    const todayFeeRevenue = feePayments
      .filter(f => new Date(f.createdAt) >= startOfToday)
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const todayRevenue = todaySlipRevenue + todayFeeRevenue;

    // This month's collection
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const thisMonthRevenue = verifiedSlips
      .filter(s => new Date(s.verifiedAt || s.studentSubmissionDate || s.createdAt) >= startOfMonth)
      .reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);

    // Pending approval count
    const pendingApprovalSlips = allSlips.filter(s => ['Proof Submitted', 'Pending Verification'].includes(s.status));
    const pendingPaymentsCount = pendingApprovalSlips.length;

    // Unique enrolled students & breakdown by technology
    const enrolledStudentMap = new Map();
    const techStats = {};
    const modeStats = {
      cash: { count: 0, amount: 0 },
      online: { count: 0, amount: 0 }
    };

    let totalDiscountsGiven = 0;
    let totalGrossValue = 0;
    let totalPendingReceivables = 0;

    verifiedSlips.forEach(s => {
      const studentId = s.student?._id ? String(s.student._id) : (s.email || s.phoneNumber || s.registrationNo);
      
      const rawTech = (s.registeredTechnology || s.technology || 'Core Track').trim();
      const tech = rawTech || 'Core Track';
      if (!techStats[tech]) {
        techStats[tech] = {
          technology: tech,
          studentCount: 0,
          totalRevenue: 0,
          totalGrossValue: 0
        };
      }
      techStats[tech].totalRevenue += Number(s.paidAmount || 0);

      // Payment mode breakdown
      const isCash = (s.paymentMode || '').toLowerCase().includes('cash') || s.transactionId === 'CASH-PAYMENT';
      if (isCash) {
        modeStats.cash.count += 1;
        modeStats.cash.amount += Number(s.paidAmount || 0);
      } else {
        modeStats.online.count += 1;
        modeStats.online.amount += Number(s.paidAmount || 0);
      }

      if (!enrolledStudentMap.has(studentId)) {
        enrolledStudentMap.set(studentId, {
          _id: s.student?._id || studentId,
          student: s.student || { fullName: s.studentName, email: s.email, phoneNumber: s.phoneNumber, college: s.college },
          fullName: s.student?.fullName || s.studentName || 'Student',
          email: s.student?.email || s.email || '',
          phoneNumber: s.student?.phoneNumber || s.phoneNumber || '',
          college: s.student?.college || s.college || 'DAV Institute of Engineering and Technology',
          technology: tech,
          duration: s.duration || '6 Months',
          totalFee: Number(s.totalFee || 25000),
          discountAmount: Number(s.discountAmount || 0),
          discountType: s.discountType || '',
          netFee: Number(s.totalFee || 25000) - Number(s.discountAmount || 0),
          paidAmount: Number(s.paidAmount || 0),
          dueAmount: Number(s.dueAmount || 0),
          slipsCount: 1,
          latestSlipNo: s.registrationNo,
          latestSlipDate: s.studentSubmissionDate || s.createdAt
        });

        techStats[tech].studentCount += 1;
        techStats[tech].totalGrossValue += Number(s.totalFee || 25000);
        totalDiscountsGiven += Number(s.discountAmount || 0);
        totalGrossValue += Number(s.totalFee || 25000);
        totalPendingReceivables += Number(s.dueAmount || 0);
      } else {
        const existing = enrolledStudentMap.get(studentId);
        existing.paidAmount += Number(s.paidAmount || 0);
        existing.dueAmount = Number(s.dueAmount !== undefined ? s.dueAmount : existing.dueAmount);
        existing.slipsCount += 1;
      }
    });

    const enrolledStudents = Array.from(enrolledStudentMap.values());
    const totalEnrolledStudents = enrolledStudents.length;

    // Convert techStats object to sorted array with percentages
    const techBreakdown = Object.values(techStats).map(item => ({
      ...item,
      percentage: totalRevenue > 0 ? Math.round((item.totalRevenue / totalRevenue) * 100) : 0
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Collection rate percentage
    const netExpectedRevenue = totalGrossValue - totalDiscountsGiven;
    const collectionRate = netExpectedRevenue > 0 ? Math.round((totalRevenue / netExpectedRevenue) * 100) : 100;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        todayRevenue,
        thisMonthRevenue,
        pendingPayments: pendingPaymentsCount,
        totalEnrolledStudents,
        totalGrossValue,
        totalDiscountsGiven,
        totalPendingReceivables,
        collectionRate,
        techBreakdown,
        modeStats,
        enrolledStudents
      }
    });
  } catch (error) {
    console.error('Error in getFinanceStats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Enrolled Students & Fee Ledger
exports.getEnrolledStudents = async (req, res) => {
  try {
    const verifiedSlips = await RegistrationSlip.find({
      status: { $in: ['Verified', 'Paid'] }
    })
      .populate('student', 'fullName email phoneNumber college course semester registeredTechnology admissionTechnology technology leadStage isRegistrationVerified totalFee totalPaidFee dueAmount discountAmount discountType')
      .sort({ createdAt: -1 });

    const studentMap = new Map();
    verifiedSlips.forEach(s => {
      const studentId = s.student?._id ? String(s.student._id) : (s.email || s.phoneNumber || s.registrationNo);
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          _id: s.student?._id || studentId,
          studentId: s.student?._id || null,
          fullName: s.student?.fullName || s.studentName || 'Student',
          email: s.student?.email || s.email || '',
          phoneNumber: s.student?.phoneNumber || s.phoneNumber || '',
          college: s.student?.college || s.college || 'DAV Institute of Engineering and Technology',
          technology: s.registeredTechnology || s.technology || 'Core Training Track',
          duration: s.duration || '6 Months',
          totalFee: Number(s.totalFee || 25000),
          discountAmount: Number(s.discountAmount || 0),
          discountType: s.discountType || '',
          netFee: Number(s.totalFee || 25000) - Number(s.discountAmount || 0),
          totalPaid: Number(s.paidAmount || 0),
          dueAmount: Number(s.dueAmount || 0),
          slipsCount: 1,
          latestSlipNo: s.registrationNo,
          latestDate: s.studentSubmissionDate || s.createdAt
        });
      } else {
        const existing = studentMap.get(studentId);
        existing.totalPaid += Number(s.paidAmount || 0);
        existing.dueAmount = Number(s.dueAmount !== undefined ? s.dueAmount : existing.dueAmount);
        existing.slipsCount += 1;
      }
    });

    const enrolledList = Array.from(studentMap.values());
    res.status(200).json({
      success: true,
      data: enrolledList
    });
  } catch (error) {
    console.error('Error fetching enrolled students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Registration Slips & Verification Requests (Finance Center)
exports.getAllRegistrationSlips = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      const lower = status.toLowerCase();
      if (lower === 'verified' || lower === 'paid') {
        filter.status = { $in: ['Verified', 'Paid'] };
      } else if (lower === 'pending' || lower === 'proof submitted' || lower === 'pending verification') {
        filter.status = { $in: ['Proof Submitted', 'Pending Verification'] };
      } else if (lower === 'installments' || lower === 'installment') {
        filter.installmentNumber = { $gt: 1 };
      } else if (lower === 'rejected') {
        filter.status = 'Rejected';
      } else {
        filter.status = status;
      }
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const orConditions = [
        { registrationNo: searchRegex },
        { transactionId: searchRegex },
        { technology: searchRegex },
        { registeredTechnology: searchRegex },
        { fatherName: searchRegex },
        { paymentMode: searchRegex },
        { remarks: searchRegex }
      ];

      try {
        const matchedStudents = await Student.find({
          $or: [
            { fullName: searchRegex },
            { email: searchRegex },
            { phoneNumber: searchRegex },
            { college: searchRegex }
          ]
        }).select('_id').lean();

        if (matchedStudents && matchedStudents.length > 0) {
          orConditions.push({ student: { $in: matchedStudents.map(s => s._id) } });
        }
      } catch (stErr) {
        console.warn('Student search match error:', stErr.message);
      }

      filter.$or = orConditions;
    }

    const slips = await RegistrationSlip.find(filter)
      .populate('student', 'fullName email phoneNumber college course semester city isRegistrationVerified')
      .populate('issuedBy', 'fullName firstName lastName email role')
      .populate('verifiedBy', 'fullName firstName lastName email role')
      .sort({ createdAt: -1 });

    const [totalCount, pendingApprovalCount, verifiedCount, rejectedCount, installmentCount] = await Promise.all([
      RegistrationSlip.countDocuments({}),
      RegistrationSlip.countDocuments({ status: { $in: ['Proof Submitted', 'Pending Verification'] } }),
      RegistrationSlip.countDocuments({ status: { $in: ['Verified', 'Paid'] } }),
      RegistrationSlip.countDocuments({ status: 'Rejected' }),
      RegistrationSlip.countDocuments({ installmentNumber: { $gt: 1 } })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        slips,
        stats: {
          totalCount,
          pendingApprovalCount,
          verifiedCount,
          rejectedCount,
          installmentCount
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllRegistrationSlips:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch registration slips', error: error.message });
  }
};

// Verify Registration Slip Payment Proof (Strictly Superadmin / Admin Only)
exports.verifyRegistrationSlip = async (req, res) => {
  try {
    const staff = req.staff || req.user;
    if (!staff) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // Strict Authorization Check: Only Superadmin, Super Admin, Admin, or Director
    const staffRole = (staff.role || staff.systemRole || '').toLowerCase();
    const isSuperAdminOrAdmin = ['superadmin', 'super_admin', 'admin', 'director'].includes(staffRole);
    if (!isSuperAdminOrAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Superadmin or Finance Admin can verify and approve student registration payments.'
      });
    }

    const { slipId } = req.params;
    const { action, rejectionReason } = req.body; // action: 'approve' | 'reject'

    if (!slipId) {
      return res.status(400).json({ success: false, message: 'Registration Slip ID is required.' });
    }

    const slip = await RegistrationSlip.findById(slipId).populate('student');
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Registration slip not found.' });
    }

    if (action === 'approve') {
      slip.status = 'Verified';
      slip.verifiedBy = staff._id;
      slip.verifiedByName = staff.fullName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Superadmin';
      slip.verifiedAt = new Date();

      const student = await Student.findById(slip.student._id);
      let calculatedDue = 0;
      let totalPaidAmount = 0;

      if (student) {
        const effectiveTotalFee = Number(student.totalFee) || Number(slip.totalFee) || 25000;

        const otherVerifiedSlips = await RegistrationSlip.find({
          student: student._id,
          _id: { $ne: slip._id },
          status: { $in: ['Verified', 'Paid'] }
        });

        const otherPaid = otherVerifiedSlips.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
        totalPaidAmount = otherPaid + (Number(slip.paidAmount) || 0);
        calculatedDue = Math.max(0, effectiveTotalFee - totalPaidAmount);

        slip.dueAmount = calculatedDue;
        await slip.save();

        student.totalFee = effectiveTotalFee;
        student.admissionFee = totalPaidAmount;
        student.registrationFee = totalPaidAmount;
        student.totalPaidFee = totalPaidAmount;
        student.netRemainingFee = calculatedDue;
        student.dueAmount = calculatedDue;
        student.pendingFee = calculatedDue;
        student.isRegistrationVerified = true;
        student.registrationSlipNo = slip.registrationNo;
        student.registrationDate = slip.verifiedAt || new Date();
        student.leadStage = 'Admission done';
        student.counselingStatus = 'enrolled';
        student.admissionTechnology = slip.technology || student.admissionTechnology;
        student.registeredTechnology = slip.registeredTechnology || slip.technology || student.registeredTechnology;
        student.registrationTechnology = slip.registeredTechnology || slip.technology || student.registrationTechnology;
        student.admissionDate = student.admissionDate || new Date();
        await student.save();
      } else {
        await slip.save();
      }

      // Record in FeePayment collection
      try {
        const feePayment = new FeePayment({
          student: slip.student._id,
          amount: slip.paidAmount,
          type: 'Admission',
          paymentMode: slip.paymentMode || 'Online',
          transactionId: slip.transactionId || slip.registrationNo,
          date: new Date(),
          status: 'Paid',
          collectedBy: staff._id,
          remarks: `Verified registration payment approved by Superadmin (Reg No: ${slip.registrationNo}, UTR: ${slip.transactionId || 'N/A'}). Remaining due: ₹${calculatedDue}`
        });
        await feePayment.save();
      } catch (feeErr) {
        console.warn('FeePayment save note:', feeErr.message);
      }

      // Generate Official PDF receipt & dispatch on WhatsApp ONLY
      let pdfDownloadUrl = '';
      try {
        await receiptService.generateAndSaveReceipt(slip, student);
        const frontendBase = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://www.wipronix.com').replace(/\/+$/, '');
        const publicReceiptUrl = `${frontendBase}/receipt/${slip.registrationNo}`;
        pdfDownloadUrl = publicReceiptUrl;
        slip.pdfUrl = publicReceiptUrl;
        await slip.save();

        if (student && student.phoneNumber) {
          const cleanDigits = (student.phoneNumber || '').toString().replace(/\D/g, '');
          const formattedMobile = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
          await msgStudio.sendWhatsAppTemplate({
            mobile: formattedMobile,
            variables: [
              student.fullName,
              slip.registrationNo,
              `₹${Number(slip.paidAmount || 0).toLocaleString()}`,
              publicReceiptUrl
            ],
            mediaUrl: publicReceiptUrl
          });
        }
      } catch (rcptErr) {
        console.warn('Error generating PDF receipt or sending WhatsApp:', rcptErr.message);
      }

      return res.status(200).json({
        success: true,
        message: `Registration payment for ${student ? student.fullName : 'Student'} verified successfully. Official slip issued and sent via WhatsApp.`,
        data: {
          slip,
          pdfUrl: pdfDownloadUrl
        }
      });
    } else if (action === 'reject') {
      slip.status = 'Rejected';
      slip.rejectionReason = rejectionReason || 'Payment proof could not be verified.';
      slip.verifiedBy = staff._id;
      slip.verifiedByName = staff.fullName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Superadmin';
      slip.verifiedAt = new Date();
      await slip.save();

      return res.status(200).json({
        success: true,
        message: `Payment proof for ${slip.registrationNo} has been marked as rejected.`,
        data: slip
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action specified. Must be "approve" or "reject".' });
    }
  } catch (error) {
    console.error('Error in verifyRegistrationSlip:', error);
    return res.status(500).json({ success: false, message: 'Verification operation failed', error: error.message });
  }
};

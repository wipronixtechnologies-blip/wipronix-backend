const FeePayment = require('../../models/FeePayment.model');
const Student = require('../../models/Student.model');

// Get all payments
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await FeePayment.find()
      .populate('student', 'fullName email phoneNumber')
      .populate('collectedBy', 'fullName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
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

// Get stats
exports.getFinanceStats = async (req, res) => {
  try {
    const [totalRevenue, todayRevenue, pendingPayments] = await Promise.all([
      FeePayment.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      FeePayment.aggregate([
        { $match: { status: 'Paid', createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      FeePayment.countDocuments({ status: 'Pending' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: totalRevenue[0]?.total || 0,
        todayRevenue: todayRevenue[0]?.total || 0,
        pendingPayments
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const mongoose = require('mongoose');

const feePaymentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
      type: String,
      enum: ['Admission', 'Tuition', 'Exam', 'Other'],
      default: 'Tuition'
  },
  paymentMode: {
    type: String,
    enum: ['Online', 'Cash', 'Cheque', 'Bank Transfer'],
    required: true
  },
  transactionId: {
      type: String,
      trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed'],
    default: 'Paid'
  },
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  remarks: String
}, {
  timestamps: true
});

module.exports = mongoose.model('FeePayment', feePaymentSchema);

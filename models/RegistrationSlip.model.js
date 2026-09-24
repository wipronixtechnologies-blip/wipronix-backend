const mongoose = require('mongoose');

const registrationSlipSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        required: true
    },
    registrationNo: {
        type: String,
        required: true,
        unique: true
    },
    installmentNumber: {
        type: Number,
        default: 1
    },
    date: {
        type: Date,
        default: Date.now
    },
    fatherName: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true
    },
    technology: {
        type: String,
        required: true
    },
    duration: {
        type: String,
        required: true
    },
    totalFee: {
        type: Number,
        required: true
    },
    paidAmount: {
        type: Number,
        required: true
    },
    dueAmount: {
        type: Number,
        required: true
    },
    paymentMode: {
        type: String,
        enum: ['Cash', 'UPI', 'Bank'],
        required: true
    },
    nextDueDate: {
        type: Date
    },
    deliveryMode: {
        type: [String],
        enum: ['Email', 'WhatsApp'],
        default: ['Email']
    },
    status: {
        type: String,
        enum: ['Pending Verification', 'Verified', 'Payment Pending', 'Paid'],
        default: 'Pending Verification'
    },
    verificationToken: {
        type: String,
        required: true
    },
    verificationTokenExpires: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('RegistrationSlip', registrationSlipSchema);

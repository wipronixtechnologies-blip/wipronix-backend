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
        trim: true,
        default: ''
    },
    address: {
        type: String,
        default: ''
    },
    technology: {
        type: String,
        required: true
    },
    registeredTechnology: {
        type: String,
        trim: true,
        default: ''
    },
    pdfUrl: {
        type: String,
        default: ''
    },
    receiptPdfPath: {
        type: String,
        default: ''
    },
    duration: {
        type: String,
        default: '6 Months'
    },
    totalFee: {
        type: Number,
        required: true
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    discountType: {
        type: String,
        trim: true,
        default: ''
    },
    netFee: {
        type: Number,
        default: null
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
        enum: ['Cash', 'UPI', 'Bank', 'Online', 'Card POS'],
        default: 'UPI'
    },
    mode: {
        type: String,
        enum: ['In-Office', 'Remote-QR'],
        default: 'In-Office'
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
        enum: [
            'Pending Payment',      // Remote QR generated, waiting for student to pay
            'Proof Submitted',      // Student submitted UTR & screenshot, awaiting review
            'Pending Verification', // Legacy status
            'Verified',             // Counselor/admin verified UTR
            'Paid',                 // Official receipt generated/paid
            'Rejected'              // Payment proof rejected
        ],
        default: 'Pending Verification'
    },
    // Remote QR / Online Payment Details
    paymentToken: {
        type: String,
        index: true,
        sparse: true
    },
    tokenExpiresAt: {
        type: Date
    },
    upiString: {
        type: String
    },
    qrDataUrl: {
        type: String
    },
    // Student submitted proof
    transactionId: {
        type: String,
        trim: true
    },
    paymentScreenshotUrl: {
        type: String
    },
    paymentScreenshots: {
        type: [String],
        default: []
    },
    studentSubmissionDate: {
        type: Date
    },
    // Verification audit
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
    },
    verifiedByName: {
        type: String
    },
    verifiedAt: {
        type: Date
    },
    rejectionReason: {
        type: String
    },
    remarks: {
        type: String
    },
    verificationToken: {
        type: String,
        default: ''
    },
    verificationTokenExpires: {
        type: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('RegistrationSlip', registrationSlipSchema);

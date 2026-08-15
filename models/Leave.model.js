const mongoose = require('mongoose');

// Leave balance schema
const leaveBalanceSchema = new mongoose.Schema({
  casual: { type: Number, default: 10 },
  sick: { type: Number, default: 10 },
  paid: { type: Number, default: 4 },
  year: { type: Number, required: true }
}, { _id: false });

// Leave request schema
const leaveSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  leaveType: {
    type: String,
    enum: ['casual', 'sick', 'paid'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalDays: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  appliedOn: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  // Track leave balances at time of application
  balanceSnapshot: {
    casual: { type: Number, default: 0 },
    sick: { type: Number, default: 0 },
    paid: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Index for efficient queries
leaveSchema.index({ staffId: 1, status: 1 });
leaveSchema.index({ staffId: 1, startDate: -1 });
leaveSchema.index({ status: 1, createdAt: -1 });

// Virtual for checking if HR leave (needs super admin approval)
leaveSchema.virtual('requiresSuperAdminApproval').get(function() {
  return this.leaveType === 'hr_leave';
});

// Virtual for formatted status
leaveSchema.virtual('statusDisplay').get(function() {
  return this.status.charAt(0).toUpperCase() + this.status.slice(1);
});

// Method to calculate working days (moved to controller)
const calculateWorkingDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    // Exclude Saturdays (6) and Sundays (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  
  return count;
};

const Leave = mongoose.model('Leave', leaveSchema);

module.exports = Leave;


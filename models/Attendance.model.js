const mongoose = require('mongoose');

// Location schema for storing latitude and longitude
const locationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  // Reference to staff member
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },

  // Date of attendance (YYYY-MM-DD format)
  date: {
    type: String,
    required: true
  },

  // Punch in details
  punchInTime: {
    type: Date,
    required: true
  },
  punchInLocation: {
    type: locationSchema,
    required: true
  },

  // Punch out details (optional until punched out)
  punchOutTime: {
    type: Date,
    default: null
  },
  punchOutLocation: {
    type: locationSchema,
    default: null
  },

  // Calculated total hours worked
  totalHours: {
    type: Number,
    default: 0
  },

  // Status of attendance
  status: {
    type: String,
    enum: ['present', 'absent', 'half_day', 'late', 'short_leave', 'pending_half_day', 'pending_other'],
    default: 'present'
  },

  // Punch out reason details
  punchOutReason: {
    type: String,
    trim: true,
    default: null
  },
  punchOutReasonType: {
    type: String,
    enum: ['half_day', 'other', null],
    default: null
  },
  punchOutApprovalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', null],
    default: null
  },

  // Additional notes
  notes: {
    type: String,
    trim: true
  },

  // System fields
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for efficient queries
attendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

// Virtual for formatted date
attendanceSchema.virtual('formattedDate').get(function() {
  if (!this.date) return null;
  const parts = this.date.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const date = new Date(year, month, day);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  const date = new Date(this.date);
  return date.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for formatted punch in time (in IST)
attendanceSchema.virtual('formattedPunchInTime').get(function() {
  return this.punchInTime ? this.punchInTime.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) : null;
});

// Virtual for formatted punch out time (in IST)
attendanceSchema.virtual('formattedPunchOutTime').get(function() {
  return this.punchOutTime ? this.punchOutTime.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) : null;
});

// Method to calculate total hours
attendanceSchema.methods.calculateTotalHours = function() {
  if (this.punchInTime && this.punchOutTime) {
    const diffMs = this.punchOutTime - this.punchInTime;
    this.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimal places
  }
  return this.totalHours;
};

// Pre-save hook to calculate total hours
attendanceSchema.pre('save', async function() {
  if (this.punchOutTime) {
    this.calculateTotalHours();
  }
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;

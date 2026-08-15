const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Main address schema
const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  zipCode: { type: String, trim: true },
  country: { type: String, trim: true },
}, { _id: false });

// Salary structure schema
const salaryStructureSchema = new mongoose.Schema({
  baseSalary: { type: Number, default: 0 },
  hra: { type: Number, default: 0 },
  transport: { type: Number, default: 0 },
  other: { type: Number, default: 0 },
  taxDeduction: { type: Number, default: 0 },
  pf: { type: Number, default: 0 },
}, { _id: false });

// Document schema - supports object with url/status fields
const documentSchema = new mongoose.Schema({
  identityProof: { type: mongoose.Schema.Types.Mixed, default: { url: '', status: 'missing' } },
  educationalCertificate: { type: mongoose.Schema.Types.Mixed, default: { url: '', status: 'missing' } },
  offerLetter: { type: mongoose.Schema.Types.Mixed, default: { url: '', status: 'missing' } },
  medicalDocument: { type: mongoose.Schema.Types.Mixed, default: { url: '', status: 'missing' } },
}, { _id: false });

const staffSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  fullName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  address: {
    type: addressSchema,
    default: {}
  },
  profileImage: {
    type: String
  },

  // Professional Details & Roles
  dateOfJoining: {
    type: Date
  },
  department: {
    type: String,
    trim: true
  },
  designation: {
    type: String,
    trim: true
  },
  reportingTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  systemRole: {
    type: String,
    enum: ['super_admin', 'admin', 'staff', 'employee', 'hr', 'hr_manager', 'project_manager', 'marketing_manager', 'development_manager', 'operation_manager', 'training_head', 'bde', 'bidder'],
    default: 'employee'
  },
  employeeType: {
    type: String,
    enum: ['full_time', 'part_time', 'contract', 'intern'],
    default: 'full_time'
  },

  // Salary Structure (HR Only)
  salaryStructure: {
    type: salaryStructureSchema,
    default: {
      baseSalary: 0,
      hra: 0,
      transport: 0,
      other: 0,
      taxDeduction: 0,
      pf: 0
    }
  },

  // Documents
  documents: {
    type: documentSchema,
    default: {}
  },

  // Offer Letter specific fields
  offerReferenceNo: {
    type: String,
    trim: true
  },
  probationDuration: {
    type: String,
    default: 'three (3) months'
  },
  retentionBonusAmount: {
    type: Number,
                default: 0
  },
  retentionBonusPeriod: {
    type: String,
    default: '12 months'
  },
  workMode: {
    type: String,
    enum: ['Office', 'Remote', 'Hybrid'],
    default: 'Office'
  },

  // System fields
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'staff', 'employee', 'hr', 'hr_manager', 'project_manager', 'marketing_manager', 'development_manager', 'operation_manager', 'training_head', 'bde', 'bidder'],
    default: 'employee'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  permissions: [{
    type: String
  }],

  // Password Reset Fields
  resetPasswordToken: {
    type: String,
    default: undefined
  },
  resetPasswordExpires: {
    type: Date,
    default: undefined
  },
  isVerified: {
    type: Boolean,
    default: false
  },

  // Leave Balance (per year tracking)
  leaveBalance: {
    casual: { type: Number, default: 10 },
    sick: { type: Number, default: 10 },
    paid: { type: Number, default: 4 },
    lastResetDate: { type: Date, default: null }
  }
}, {
  timestamps: true
});

// Update fullName before saving or updating
staffSchema.pre('save', function() {
  if (this.isModified('firstName') || this.isModified('lastName')) {
    this.fullName = `${this.firstName} ${this.lastName}`.trim();
  }

  // Enforce single super_admin policy
  const superAdminEmail = 'wipronixtechnologies@gmail.com';
  if ((this.role === 'super_admin' || this.systemRole === 'super_admin') && this.email !== superAdminEmail) {
    console.warn(`Unauthorized super_admin attempt by ${this.email}. Demoting to admin.`);
    this.role = 'admin';
    this.systemRole = 'admin';
  }
});

staffSchema.pre('findOneAndUpdate', function() {
  const update = this.getUpdate();
  if (update.firstName || update.lastName) {
    // Note: It's complex to recalculate fullName in query middleware accurately
    // since we might only have partial names. 
    // This is currently handled in the controller.
  }
});

// Virtual for full name (keeps compatibility with existing code)
staffSchema.virtual('fullNameVirtual').get(function() {
  return this.fullName;
});

// Pre-save hook for password hashing
staffSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
staffSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
staffSchema.methods.toJSON = function() {
  const staff = this.toObject();
  delete staff.password;
  return staff;
};

// Index for search
staffSchema.index({ fullName: 'text', email: 'text', department: 'text' });

const Staff = mongoose.model('Staff', staffSchema);

module.exports = Staff;


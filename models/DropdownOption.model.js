const mongoose = require('mongoose');

const dropdownOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['technology', 'domain', 'businessModel'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index to ensure uniqueness of name per dropdown type
dropdownOptionSchema.index({ name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('DropdownOption', dropdownOptionSchema);

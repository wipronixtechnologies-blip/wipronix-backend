const mongoose = require('mongoose');

const webinarRegistrationSchema = new mongoose.Schema(
  {
    webinarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Webinar',
      required: [true, 'Webinar ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email ID is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
    },
    passingYear: {
      type: String,
      required: [true, 'Passing year is required'],
      trim: true,
    },
    stream: {
      type: String,
      required: [true, 'Stream/Branch is required'],
      trim: true,
    },
    interestedTechnology: {
      type: String,
      required: [true, 'Interested technology is required'],
      trim: true,
    },
    college: {
      type: String,
      required: [true, 'College/University name is required'],
      trim: true,
    },
    workWithMohaliAi: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['Registered', 'Attended', 'Absent', 'Shortlisted'],
      default: 'Registered',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate registration for the same webinar with the same email
webinarRegistrationSchema.index({ webinarId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('WebinarRegistration', webinarRegistrationSchema);

const mongoose = require('mongoose');

const webinarSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Webinar title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Webinar description is required'],
    },
    photoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    speakerName: {
      type: String,
      required: [true, 'Speaker name is required'],
      trim: true,
    },
    speakerRole: {
      type: String,
      default: 'Keynote Speaker',
      trim: true,
    },
    speakerBio: {
      type: String,
      default: '',
    },
    speakerPhotoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
    },
    duration: {
      type: String,
      default: '60 Mins',
      trim: true,
    },
    platform: {
      type: String,
      default: 'Google Meet',
      trim: true,
    },
    meetingLink: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isLive: {
      type: Boolean,
      default: false,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast query of active webinars
webinarSchema.index({ isActive: 1, startDate: -1 });

module.exports = mongoose.model('Webinar', webinarSchema);

const mongoose = require('mongoose');

const performanceReviewSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  reviewerName: {
    type: String,
    required: true
  },
  reviewPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  reviewType: {
    type: String,
    enum: ['quarterly', 'half_yearly', 'annual', 'probation'],
    default: 'quarterly'
  },
  ratings: {
    technical: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    teamwork: { type: Number, min: 1, max: 5 },
    leadership: { type: Number, min: 1, max: 5 },
    productivity: { type: Number, min: 1, max: 5 },
    punctuality: { type: Number, min: 1, max: 5 }
  },
  overallRating: {
    type: Number,
    min: 1,
    max: 5
  },
  strengths: {
    type: String
  },
  areasOfImprovement: {
    type: String
  },
  achievements: [{
    type: String
  }],
  goals: [{
    type: String
  }],
  comments: {
    type: String
  },
  employeeComments: {
    type: String
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'acknowledged', 'completed'],
    default: 'draft'
  },
  acknowledgedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Calculate overall rating before saving
performanceReviewSchema.pre('save', function() {
  if (this.ratings) {
    const ratings = Object.values(this.ratings).filter(r => r !== undefined && r !== null);
    if (ratings.length > 0) {
      this.overallRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
    }
  }
});

const PerformanceReview = mongoose.model('PerformanceReview', performanceReviewSchema);

module.exports = PerformanceReview;

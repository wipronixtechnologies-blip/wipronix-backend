const PerformanceReview = require('../../models/PerformanceReview.model');
const Notification = require('../../models/Notification.model');
const Goal = require('../../models/Goal.model');
const TrainingAssignment = require('../../models/TrainingAssignment.model');
const { createNotification } = require('../Notification/notificationController');

// Get all performance reviews for an employee
exports.getMyReviews = async (req, res) => {
  try {
    const employeeId = req.staff._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await PerformanceReview.find({ employee: employeeId })
      .sort({ 'reviewPeriod.endDate': -1 })
      .skip(skip)
      .limit(limit)
      .populate('reviewer', 'fullName profileImage role');

    const total = await PerformanceReview.countDocuments({ employee: employeeId });

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching performance reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance reviews',
      error: error.message
    });
  }
};

// Get single review
exports.getReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.staff._id;

    const review = await PerformanceReview.findById(reviewId)
      .populate('employee', 'fullName email profileImage department designation')
      .populate('reviewer', 'fullName profileImage role');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user is the employee or reviewer
    if (review.employee._id.toString() !== userId && review.reviewer._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review',
      error: error.message
    });
  }
};

// Acknowledge review (employee)
exports.acknowledgeReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { employeeComments } = req.body;
    const userId = req.staff._id;

    const review = await PerformanceReview.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (review.employee.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    review.status = 'acknowledged';
    review.acknowledgedAt = new Date();
    if (employeeComments) {
      review.employeeComments = employeeComments;
    }

    await review.save();

    // Notify reviewer
    await createNotification(review.reviewer, {
      sender: userId,
      senderName: req.staff.fullName,
      type: 'performance',
      title: 'Performance Review Acknowledged',
      message: `${req.staff.fullName} has acknowledged their performance review`,
      link: `/performance/reviews/${reviewId}`,
      priority: 'normal'
    });

    res.status(200).json({
      success: true,
      message: 'Review acknowledged successfully',
      data: review
    });
  } catch (error) {
    console.error('Error acknowledging review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge review',
      error: error.message
    });
  }
};

// Create performance review (Admin/HR only)
exports.createReview = async (req, res) => {
  try {
    const reviewerId = req.staff._id;
    const reviewerName = req.staff.fullName;

    const review = new PerformanceReview({
      ...req.body,
      reviewer: reviewerId,
      reviewerName
    });

    await review.save();

    // Notify employee
    await createNotification(review.employee, {
      sender: reviewerId,
      senderName: reviewerName,
      type: 'performance',
      title: 'New Performance Review',
      message: `You have a new performance review from ${reviewerName}`,
      link: `/performance/reviews/${review._id}`,
      priority: 'high'
    });

    res.status(201).json({
      success: true,
      message: 'Performance review created successfully',
      data: review
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create review',
      error: error.message
    });
  }
};

// Get performance stats
exports.getPerformanceStats = async (req, res) => {
  try {
    const employeeId = req.staff._id;

    const reviews = await PerformanceReview.find({ employee: employeeId });
    const goalCount = await Goal.countDocuments({ employee: employeeId });
    const completedGoals = await Goal.countDocuments({ employee: employeeId, status: 'completed' });
    
    // Fetch real training data
    const trainings = await TrainingAssignment.find({ staff: employeeId });
    const totalTrainingHours = trainings.reduce((acc, curr) => acc + (curr.hoursCompleted || 0), 0);
    const completedTrainings = trainings.filter(t => t.status === 'completed').length;

    const stats = {
      totalReviews: reviews.length,
      averageRating: 0,
      latestReview: null,
      ratingTrend: [],
      goals: {
          total: goalCount,
          active: goalCount - completedGoals,
          completed: completedGoals
      },
      training: {
          hours: totalTrainingHours,
          target: 40,
          completedCount: completedTrainings,
          totalCount: trainings.length
      }
    };

    if (reviews.length > 0) {
      const ratings = reviews.map(r => r.overallRating).filter(r => r);
      if (ratings.length > 0) {
         stats.averageRating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
      }
      stats.latestReview = reviews.sort((a, b) => 
        new Date(b.reviewPeriod.endDate) - new Date(a.reviewPeriod.endDate)
      )[0];
      stats.ratingTrend = reviews.slice(-5).map(r => ({
        period: `${new Date(r.reviewPeriod.startDate).toLocaleDateString()} - ${new Date(r.reviewPeriod.endDate).toLocaleDateString()}`,
        rating: r.overallRating
      }));
    }

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching performance stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance stats',
      error: error.message
    });
  }
};

// Get all goals for the logged-in employee
exports.getMyGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ employee: req.staff._id }).sort({ targetDate: 1 });
    res.status(200).json({
      success: true,
      data: goals
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch goals',
      error: error.message
    });
  }
};

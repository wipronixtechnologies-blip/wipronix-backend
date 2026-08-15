const TrainingAssignment = require('../../models/TrainingAssignment.model');
const Staff = require('../../models/Staff.model');
const { createNotification } = require('../Notification/notificationController');

// Get all training assignments for logged in employee
exports.getMyTrainings = async (req, res) => {
  try {
    const userId = req.staff.id || req.staff._id;
    const trainings = await TrainingAssignment.find({ staff: userId }).sort({ targetDate: 1 });

    res.status(200).json({
      success: true,
      data: trainings
    });
  } catch (error) {
    console.error('Error fetching trainings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trainings',
      error: error.message
    });
  }
};

// Create/Assign training (Admin/HR only)
exports.assignTraining = async (req, res) => {
  try {
    const { staffId, title, description, category, targetDate, priority, hoursEstimated } = req.body;
    const adminId = req.staff.id || req.staff._id;

    const assignment = new TrainingAssignment({
      staff: staffId,
      title,
      description,
      category,
      targetDate,
      priority,
      hoursEstimated,
      assignedBy: adminId,
      status: 'not_started'
    });

    await assignment.save();

    // Notify employee
    await createNotification(staffId, {
      sender: adminId,
      senderName: req.staff.fullName,
      type: 'performance',
      title: 'New Skill Development Assigned',
      message: `You have been assigned a new development objective: ${title}`,
      link: '/performance',
      priority: 'normal'
    });

    res.status(201).json({
      success: true,
      message: 'Professional development assigned successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Error assigning training:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign development objective',
      error: error.message
    });
  }
};

// Update training progress (Employee)
exports.updateProgress = async (req, res) => {
  try {
    const { trainingId } = req.params;
    const { progress, hoursCompleted, status } = req.body;
    const userId = req.staff.id || req.staff._id;

    const training = await TrainingAssignment.findOne({ _id: trainingId, staff: userId });

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    if (progress !== undefined) training.progress = progress;
    if (hoursCompleted !== undefined) training.hoursCompleted = hoursCompleted;
    if (status !== undefined) {
        training.status = status;
        if (status === 'completed') {
            training.completedAt = new Date();
            training.progress = 100;
        }
    }

    await training.save();

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
      data: training
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update progress',
      error: error.message
    });
  }
};

// Get all staff trainings (Admin)
exports.getAllStaffTrainings = async (req, res) => {
    try {
        const trainings = await TrainingAssignment.find()
            .populate('staff', 'fullName email department profileImage')
            .populate('assignedBy', 'fullName')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: trainings
        });
    } catch (error) {
        console.error('Error fetching all trainings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch all development objectives',
            error: error.message
        });
    }
};

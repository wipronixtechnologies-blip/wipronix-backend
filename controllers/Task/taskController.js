const Task = require('../../models/Task.model');
const Staff = require('../../models/Staff.model');
const Notification = require('../../models/Notification.model'); // Import Notification model
const mongoose = require('mongoose'); // Import mongoose
const { 
  emitTaskAssigned, 
  emitTaskUpdated, 
  emitTaskStatusUpdated, 
  emitTaskDeleted, 
  emitNotification 
} = require('../../src/services/socket');
const { logActivity } = require('../Activity/activityController');

// Create a new task
const createTask = async (request, response) => {
  try {
    const { title, description, assignedTo, deadline, priority, notes } = request.body;
    const assignedBy = request.staff._id;

    // Validate input
    if (!title || !description || !assignedTo || !deadline) {
      return response.status(400).json({
        success: false,
        message: 'Title, description, assignedTo, and deadline are required'
      });
    }

    // Check if assignedTo staff exists
    const assignedStaff = await Staff.findById(assignedTo);
    if (!assignedStaff) {
      return response.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Create task
    const task = new Task({
      title,
      description,
      assignedTo,
      assignedBy,
      deadline,
      priority: priority || 'medium',
      notes: notes || ''
    });

    await task.save();

    // Populate the task with staff details for response and socket emission
    await task.populate('assignedTo', 'fullName email designation department');
    await task.populate('assignedBy', 'fullName email');

    // Emit real-time event
    emitTaskAssigned(assignedTo, task);
    
    // Log activity
    await logActivity({
        type: 'task_assigned',
        user: request.staff.fullName,
        actorId: assignedBy,
        actorRole: request.staff.role,
        action: 'assigned a task',
        target: title,
        targetId: assignedTo, // The user receiving the task
        metadata: { taskId: task._id }
    });

    // Create notification
    try {
        const notification = new Notification({
            recipient: assignedTo,
            sender: assignedBy,
            senderName: request.staff.fullName, 
            type: 'task', 
            title: 'New Task Assigned',
            message: `You have been assigned a new task: ${title}`,
            link: `/daily-task`, 
            priority: 'high',
            isRead: false
        });
        await notification.save();
        
        emitNotification(assignedTo, notification);
    } catch (notifError) {
        console.error("Failed to create notification for task:", notifError);
    }

    response.status(201).json({
      success: true,
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    console.error('Create task error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all tasks (for super_admin, admin)
const getAllTasks = async (request, response) => {
  try {
    const { status, priority, assignedTo, assignedBy } = request.query;
    
    const query = {};
    if (status && status !== 'undefined' && status !== 'null') query.status = status;
    if (priority && priority !== 'undefined' && priority !== 'null') query.priority = priority;
    if (assignedTo && assignedTo !== 'undefined' && assignedTo !== 'null') query.assignedTo = assignedTo;
    if (assignedBy && assignedBy !== 'undefined' && assignedBy !== 'null') query.assignedBy = assignedBy;

    const tasks = await Task.find(query)
      .populate('assignedTo', 'fullName email designation department')
      .populate('assignedBy', 'fullName email')
      .sort({ createdAt: -1 });

    response.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error('SERVER ERROR - [getAllTasks]:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get tasks for a specific staff member
const getMyTasks = async (request, response) => {
  try {
    const userId = request.staff._id;
    const { status } = request.query;

    console.log(`[getMyTasks] Fetching for user: ${userId} (${request.staff.fullName})`);

    const query = { assignedTo: userId };
    if (status && status !== 'undefined' && status !== 'null') query.status = status;

    console.log(`[getMyTasks] Query:`, JSON.stringify(query));

    const tasks = await Task.find(query)
      .populate('assignedBy', 'fullName email designation')
      .sort({ deadline: 1 });
    
    console.log(`[getMyTasks] Found ${tasks.length} tasks`);

    response.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error('Get my tasks error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get tasks assigned by the logged-in manager
const getAssignedTasks = async (request, response) => {
  try {
    const managerId = request.staff._id;
    const { status } = request.query;

    const query = { assignedBy: managerId };
    if (status) query.status = status;

    const tasks = await Task.find(query)
      .populate('assignedTo', 'fullName email designation department')
      .sort({ createdAt: -1 });

    response.status(200).json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error('Get assigned tasks error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single task by ID
const getTaskById = async (request, response) => {
  try {
    const { id } = request.params;
    const userRole = request.staff.role;
    const userId = request.staff._id.toString();

    const task = await Task.findById(id)
      .populate('assignedTo', 'fullName email designation department')
      .populate('assignedBy', 'fullName email designation');

    if (!task) {
      return response.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check access: only assigned staff, assigned by staff, or admin can view
    const hasAccess = 
      task.assignedTo._id.toString() === userId ||
      task.assignedBy._id.toString() === userId ||
      ['super_admin', 'admin', 'project_manager'].includes(userRole);

    if (!hasAccess) {
      return response.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    response.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    console.error('Get task by ID error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update task
const updateTask = async (request, response) => {
  try {
    const { id } = request.params;
    const { title, description, deadline, status, priority, notes, assignedTo } = request.body;
    const userRole = request.staff.role;
    const userId = request.staff._id.toString();

    const task = await Task.findById(id);
    if (!task) {
      return response.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check access: only assigned by staff, or admin can update
    const hasAccess = 
      task.assignedBy.toString() === userId ||
      ['super_admin', 'admin', 'project_manager'].includes(userRole);

    if (!hasAccess) {
      return response.status(403).json({
        success: false,
        message: 'Access denied. Only the manager who assigned the task or admin can update it.'
      });
    }

    // Update fields
    if (title) task.title = title;
    if (description) task.description = description;
    if (deadline) task.deadline = deadline;
    if (priority) task.priority = priority;
    if (notes !== undefined) task.notes = notes;
    
    if (assignedTo) {
      const assignedStaff = await Staff.findById(assignedTo);
      if (!assignedStaff) {
        return response.status(404).json({
          success: false,
          message: 'Staff member not found'
        });
      }
      task.assignedTo = assignedTo;
    }

    // If marking as completed
    if (status === 'completed' && task.status !== 'completed') {
      task.completedAt = new Date();
    }

    task.status = status || task.status;

    // Check for overdue status
    task.checkOverdue();

    await task.save();

    await task.populate('assignedTo', 'fullName email designation department');
    await task.populate('assignedBy', 'fullName email');

    // Emit update event to the assigned user
    emitTaskUpdated(task.assignedTo._id, task);

    response.status(200).json({
      success: true,
      message: 'Task updated successfully',
      task
    });

    // Log Activity
    await logActivity({
        type: 'request_actioned',
        user: request.staff.fullName,
        actorId: userId,
        action: 'updated task details',
        target: task.title,
        targetId: task.assignedTo._id,
        metadata: { taskId: task._id, status: task.status }
    });
  } catch (error) {
    console.error('Update task error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update task status (for assigned staff to update their task status)
const updateTaskStatus = async (request, response) => {
  try {
    const { id } = request.params;
    const { status } = request.body;
    const userId = request.staff._id.toString();

    const task = await Task.findById(id);
    if (!task) {
      return response.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Only assigned staff can update status
    if (task.assignedTo.toString() !== userId) {
      return response.status(403).json({
        success: false,
        message: 'Access denied. Only the assigned staff can update the task status.'
      });
    }

    task.status = status;
    
    if (status === 'completed') {
      task.completedAt = new Date();
      
      // Log completion activity
      await logActivity({
          type: 'task_completed',
          user: request.staff.fullName,
          actorId: userId,
          actorRole: request.staff.role,
          action: 'completed task',
          target: task.title,
          targetId: task.assignedBy, // Manager is the "target" sort of, or just general.
          // Actually, if we want it to show up for the manager, targetId should be assignedBy.
          // If we want it to show up for the employee, actorId is userId.
          metadata: { taskId: task._id }
      });
    }

    // Check for overdue status
    task.checkOverdue();

    await task.save();

    // Create notification for the manager who assigned the task
    try {
        const notification = new Notification({
            recipient: task.assignedBy, // Notify the manager
            sender: userId,
            senderName: request.staff.fullName,
            type: 'task', 
            title: 'Task Status Updated',
            message: `${request.staff.fullName} updated task status to ${status}: ${task.title}`,
            link: `/daily-task`,
            priority: 'medium',
            isRead: false
        });
        await notification.save();
        
        emitNotification(task.assignedBy, notification);
        
        // Also emit the status update for real-time task list update
        emitTaskStatusUpdated(task.assignedBy, task);

    } catch (notifError) {
        console.error("Failed to create notification for task status update:", notifError);
    }

    response.status(200).json({
      success: true,
      message: 'Task status updated successfully',
      task
    });
  } catch (error) {
    console.error('Update task status error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete task
const deleteTask = async (request, response) => {
  try {
    const { id } = request.params;
    const userRole = request.staff.role;
    const userId = request.staff._id.toString();

    const task = await Task.findById(id);
    if (!task) {
      return response.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check access: only assigned by staff, or admin can delete
    const hasAccess = 
      task.assignedBy.toString() === userId ||
      ['super_admin', 'admin'].includes(userRole);

    if (!hasAccess) {
      return response.status(403).json({
        success: false,
        message: 'Access denied. Only the manager who assigned the task or admin can delete it.'
      });
    }

    const assignedToId = task.assignedTo;

    await Task.findByIdAndDelete(id);

    // Notify the assigned user that the task is deleted
    emitTaskDeleted(assignedToId, id);

    response.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });

    // Log Activity
    await logActivity({
        type: 'staff_deleted', // Or 'request_actioned' since it's a task. 
        // Actually I should use 'request_actioned' or add 'task_deleted'
        user: request.staff.fullName,
        actorId: userId,
        action: `deleted task: ${task.title}`,
        target: task.title,
        targetId: assignedToId
    });
  } catch (error) {
    console.error('Delete task error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get task statistics
const getTaskStats = async (request, response) => {
  try {
    const userId = request.staff._id; // ObjectId from auth middleware
    const userRole = request.staff.role;
    const isManager = ['project_manager', 'super_admin', 'admin'].includes(userRole);

    let matchQuery;
    
    // Ensure we are matching ObjectIds correctly
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (isManager) {
      // Managers see stats for tasks they assigned
      matchQuery = { assignedBy: userObjectId };
    } else {
      // Staff see stats for tasks assigned to them
      matchQuery = { assignedTo: userObjectId };
    }

    // Also consider if an Admin wants to see global stats?
    // For now stick to "Assigned By Me" for managers to align with filtering logic

    const stats = await Task.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0
    };

    stats.forEach(stat => {
        // Handle varying case or status formatting if necessary
        // Assuming status is lowercase as per schema ('pending', 'in_progress', etc.)
        const key = stat._id.toLowerCase();
        if (formattedStats.hasOwnProperty(key)) {
             formattedStats[key] = stat.count;
        }
    });

    response.status(200).json({
      success: true,
      stats: formattedStats
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    response.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createTask,
  getAllTasks,
  getMyTasks,
  getAssignedTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskStats
};

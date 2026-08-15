const express = require('express');
const router = express.Router();
const taskController = require('../../controllers/Task/taskController');
const { checkPermission } = require('../../controllers/Auth/staffProfile');

// Note: All routes are already authenticated via authenticateStaff middleware in Staff.route.js

// Staff can get their own tasks
router.get('/my-tasks', taskController.getMyTasks);

// Manager can get tasks they assigned
router.get('/assigned-tasks', taskController.getAssignedTasks);

// Get task statistics
router.get('/stats', taskController.getTaskStats);

// Get single task
router.get('/:id', taskController.getTaskById);

// Create task - requires Tasks:write or Tasks:create permission
router.post('/', checkPermission('Tasks:write'), taskController.createTask);

// Update task
router.put('/:id', checkPermission('Tasks:write'), taskController.updateTask);

// Update task status - open to staff (usually checked in controller for ownership)
router.patch('/:id/status', taskController.updateTaskStatus);

// Delete task - requires Tasks:delete
router.delete('/:id', checkPermission('Tasks:delete'), taskController.deleteTask);

// Get all tasks - requires Tasks:read (admin view)
router.get('/', checkPermission('Tasks:read'), taskController.getAllTasks);

module.exports = router;


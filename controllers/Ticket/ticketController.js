const Ticket = require('../../models/Ticket.model');
const Activity = require('../../models/Activity.model');

// Create a new request (Ticket, Certificate, Meeting)
exports.createRequest = async (req, res) => {
  try {
    const { type, subject, description, priority, category } = req.body;
    const employeeId = req.staff._id;
    const employeeName = req.staff.fullName;

    // Map frontend 'type' to backend 'category' if needed
    let mappedCategory = category;
    
    if (type === 'Certificate') {
        mappedCategory = 'certificate_request';
    } else if (type === 'Meeting') {
        mappedCategory = 'facility';
    } else if (type === 'Ticket' && !category) {
        mappedCategory = 'it_support'; // Default
    }

    // Create ticket object
    const ticket = new Ticket({
      employee: employeeId,
      employeeName: employeeName,
      employeeEmail: req.staff.email,
      category: mappedCategory,
      priority: priority || 'medium',
      subject: subject || `${type} Request`,
      description: description || 'No description provided',
      status: 'open'
    });

    await ticket.save();

    // Create activity log
    await Activity.create({
        type: 'ticket_created',
        user: employeeName,
        actorId: employeeId,
        action: `raised a ${req.body.type || 'Request'}`,
        target: ticket.subject,
        targetId: ticket._id,
        metadata: { category: mappedCategory, priority: ticket.priority }
    });

    res.status(201).json({
      success: true,
      message: `${type} request submitted successfully`,
      data: ticket
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create request',
      error: error.message
    });
  }
};

// Get recent requests for the logged-in employee
exports.getMyRequests = async (req, res) => {
  try {
    const employeeId = req.staff._id;
    const limit = parseInt(req.query.limit) || 5;

    const tickets = await Ticket.find({ employee: employeeId })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: error.message
    });
  }
};

// Admin: Get all requests across the organization
exports.getAllRequests = async (req, res) => {
  try {
    const { status, category, priority } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    const tickets = await Ticket.find(filter)
      .sort({ createdAt: -1 })
      .populate('employee', 'fullName email department profileImage');

    res.status(200).json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching all requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all requests',
      error: error.message
    });
  }
};

// Admin: Update request status and add resolution
exports.updateRequestStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, resolution } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    ticket.status = status;
    if (resolution) ticket.resolution = resolution;
    if (status === 'resolved' || status === 'closed') {
        ticket.resolvedAt = new Date();
    }

    await ticket.save();

    // Create activity log
    if (status === 'resolved' || status === 'closed') {
        await Activity.create({
            type: 'ticket_resolved',
            user: req.staff.fullName,
            actorId: req.staff._id,
            action: `resolved a ticket: ${ticket.subject}`,
            target: ticket.employeeName,
            targetId: ticket._id,
            metadata: { status }
        });
    }

    res.status(200).json({
      success: true,
      message: `Request status updated to ${status}`,
      data: ticket
    });
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update request',
      error: error.message
    });
  }
};

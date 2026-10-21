const Webinar = require('../../models/Webinar.model');
const WebinarRegistration = require('../../models/WebinarRegistration.model');

// ============================================================================
// PUBLIC CONTROLLER METHODS
// ============================================================================

/**
 * Get current active webinar for website popup and page
 * Priority: Currently isLive=true, then isActive=true with closest upcoming/latest date
 */
exports.getActiveWebinar = async (req, res) => {
  try {
    const webinar = await Webinar.findOne({ isActive: true })
      .sort({ isLive: -1, startDate: -1, createdAt: -1 })
      .lean();

    if (!webinar) {
      return res.status(200).json({
        success: true,
        webinar: null,
        message: 'No active webinar currently scheduled'
      });
    }

    return res.status(200).json({
      success: true,
      webinar
    });
  } catch (error) {
    console.error('Error fetching active webinar:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active webinar',
      error: error.message
    });
  }
};

/**
 * Get single webinar by ID (Public)
 */
exports.getWebinarById = async (req, res) => {
  try {
    const { id } = req.params;
    const webinar = await Webinar.findById(id).lean();

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found'
      });
    }

    return res.status(200).json({
      success: true,
      webinar
    });
  } catch (error) {
    console.error('Error fetching webinar by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve webinar details',
      error: error.message
    });
  }
};

/**
 * Register a student for a specific webinar
 * Stores into isolated WebinarRegistration collection
 */
exports.registerForWebinar = async (req, res) => {
  try {
    const {
      webinarId,
      name,
      email,
      contactNumber,
      passingYear,
      stream,
      interestedTechnology,
      college,
      workWithMohaliAi = true
    } = req.body;

    // Field validations
    if (!webinarId) {
      return res.status(400).json({
        success: false,
        message: 'Webinar ID is required'
      });
    }

    if (!name || !email || !contactNumber || !passingYear || !stream || !interestedTechnology || !college) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields (name, email, contact number, passing year, stream, interested technology, college)'
      });
    }

    // Verify webinar exists
    const webinar = await Webinar.findById(webinarId);
    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found or no longer available'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if candidate already registered for this webinar
    const existingRegistration = await WebinarRegistration.findOne({
      webinarId,
      email: cleanEmail
    });

    if (existingRegistration) {
      return res.status(200).json({
        success: true,
        alreadyRegistered: true,
        message: 'You have already registered for this webinar! We have saved your seat.',
        registration: existingRegistration
      });
    }

    // Extract client IP and user agent defensively
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '');
    const userAgent = req.headers['user-agent'] || '';

    // Create registration in isolated collection
    const registration = await WebinarRegistration.create({
      webinarId,
      name: name.trim(),
      email: cleanEmail,
      contactNumber: contactNumber.trim(),
      passingYear: String(passingYear).trim(),
      stream: stream.trim(),
      interestedTechnology: interestedTechnology.trim(),
      college: college.trim(),
      workWithMohaliAi: Boolean(workWithMohaliAi),
      ipAddress,
      userAgent
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Looking forward to seeing you at the webinar.',
      registration
    });
  } catch (error) {
    console.error('Error registering for webinar:', error);

    // Handle Mongo duplicate key error gracefully
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        alreadyRegistered: true,
        message: 'You have already registered for this webinar with this email address.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to complete webinar registration. Please try again.',
      error: error.message
    });
  }
};

// ============================================================================
// SUPER ADMIN ONLY CONTROLLER METHODS
// ============================================================================

/**
 * Get all webinars with registration counts (Super Admin only)
 */
exports.getAllWebinars = async (req, res) => {
  try {
    const webinars = await Webinar.find()
      .sort({ createdAt: -1 })
      .lean();

    // Fetch registration count for each webinar
    const webinarIds = webinars.map(w => w._id);
    const counts = await WebinarRegistration.aggregate([
      { $match: { webinarId: { $in: webinarIds } } },
      { $group: { _id: '$webinarId', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    counts.forEach(c => {
      countMap[String(c._id)] = c.count;
    });

    const enriched = webinars.map(w => ({
      ...w,
      registrationCount: countMap[String(w._id)] || 0
    }));

    return res.status(200).json({
      success: true,
      webinars: enriched
    });
  } catch (error) {
    console.error('Error fetching all webinars:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch webinars',
      error: error.message
    });
  }
};

/**
 * Create a new webinar (Super Admin only)
 */
exports.createWebinar = async (req, res) => {
  try {
    const {
      title,
      description,
      photoUrl,
      speakerName,
      speakerRole,
      speakerBio,
      speakerPhotoUrl,
      startDate,
      startTime,
      duration,
      platform,
      meetingLink,
      isActive = true,
      isLive = false,
      tags
    } = req.body;

    if (!title || !description || !speakerName || !startDate || !startTime) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, speaker name, start date, and start time are required'
      });
    }

    // If making this webinar active, optionally deactivate any other active webinars
    if (isActive) {
      await Webinar.updateMany({ _id: { $ne: null } }, { isActive: false });
    }

    const webinar = await Webinar.create({
      title: title.trim(),
      description: description.trim(),
      photoUrl: photoUrl ? photoUrl.trim() : '',
      speakerName: speakerName.trim(),
      speakerRole: speakerRole ? speakerRole.trim() : 'Keynote Speaker',
      speakerBio: speakerBio ? speakerBio.trim() : '',
      speakerPhotoUrl: speakerPhotoUrl ? speakerPhotoUrl.trim() : '',
      startDate: new Date(startDate),
      startTime: startTime.trim(),
      duration: duration ? duration.trim() : '60 Mins',
      platform: platform ? platform.trim() : 'Google Meet',
      meetingLink: meetingLink ? meetingLink.trim() : '',
      isActive: Boolean(isActive),
      isLive: Boolean(isLive),
      tags: Array.isArray(tags) ? tags : [],
      createdBy: req.staff?._id
    });

    return res.status(201).json({
      success: true,
      message: 'Webinar created successfully',
      webinar
    });
  } catch (error) {
    console.error('Error creating webinar:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create webinar',
      error: error.message
    });
  }
};

/**
 * Update an existing webinar (Super Admin only)
 */
exports.updateWebinar = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }

    // If setting active, deactivate other webinars
    if (updateData.isActive === true) {
      await Webinar.updateMany({ _id: { $ne: id } }, { isActive: false });
    }

    const updatedWebinar = await Webinar.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedWebinar) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Webinar updated successfully',
      webinar: updatedWebinar
    });
  } catch (error) {
    console.error('Error updating webinar:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update webinar',
      error: error.message
    });
  }
};

/**
 * Toggle webinar status (isActive / isLive) (Super Admin only)
 */
exports.toggleWebinarStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { field } = req.body; // 'isActive' or 'isLive'

    if (!['isActive', 'isLive'].includes(field)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid toggle field. Must be isActive or isLive'
      });
    }

    const webinar = await Webinar.findById(id);
    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found'
      });
    }

    const nextValue = !webinar[field];

    // If making active, deactivate other webinars
    if (field === 'isActive' && nextValue) {
      await Webinar.updateMany({ _id: { $ne: id } }, { isActive: false });
    }

    webinar[field] = nextValue;
    await webinar.save();

    return res.status(200).json({
      success: true,
      message: `${field} updated to ${nextValue}`,
      webinar
    });
  } catch (error) {
    console.error('Error toggling webinar status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle webinar status',
      error: error.message
    });
  }
};

/**
 * Delete a webinar and all its associated registrations (Super Admin only)
 */
exports.deleteWebinar = async (req, res) => {
  try {
    const { id } = req.params;
    const webinar = await Webinar.findByIdAndDelete(id);

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found'
      });
    }

    // Cascade delete isolated registrations
    const deleteResult = await WebinarRegistration.deleteMany({ webinarId: id });

    return res.status(200).json({
      success: true,
      message: 'Webinar and associated registrations deleted successfully',
      deletedRegistrationsCount: deleteResult.deletedCount
    });
  } catch (error) {
    console.error('Error deleting webinar:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete webinar',
      error: error.message
    });
  }
};

/**
 * Get registrations for a specific webinar or all registrations (Super Admin only)
 */
exports.getWebinarRegistrations = async (req, res) => {
  try {
    const { webinarId } = req.params;
    const { search, stream, passingYear } = req.query;

    const filter = {};
    if (webinarId && webinarId !== 'all') {
      filter.webinarId = webinarId;
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { contactNumber: regex },
        { college: regex },
        { interestedTechnology: regex }
      ];
    }

    if (stream) {
      filter.stream = new RegExp(`^${stream.trim()}$`, 'i');
    }

    if (passingYear) {
      filter.passingYear = String(passingYear).trim();
    }

    const registrations = await WebinarRegistration.find(filter)
      .populate('webinarId', 'title startDate startTime')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: registrations.length,
      registrations
    });
  } catch (error) {
    console.error('Error fetching webinar registrations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch webinar registrations',
      error: error.message
    });
  }
};

/**
 * Delete a single registration (Super Admin only)
 */
exports.deleteWebinarRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const deleted = await WebinarRegistration.findByIdAndDelete(registrationId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Registration record not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Registration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting registration:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete registration',
      error: error.message
    });
  }
};

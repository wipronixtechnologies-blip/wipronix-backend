const Webinar = require('../../models/Webinar.model');
const WebinarRegistration = require('../../models/WebinarRegistration.model');

// ============================================================================
// TIMING HELPER METHODS
// ============================================================================

/**
 * Accurately calculate webinar start date, end date, and expiration status.
 * Takes into account startDate, startTime (e.g. '05:47 PM'), and duration (e.g. '90 Mins').
 */
const getWebinarTimingInfo = (webinar) => {
  if (!webinar || !webinar.startDate) return null;

  try {
    const rawDate = new Date(webinar.startDate);
    if (isNaN(rawDate.getTime())) return null;

    let year, month, day;
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      }).formatToParts(rawDate);
      year = parseInt(parts.find(p => p.type === 'year')?.value, 10);
      month = parseInt(parts.find(p => p.type === 'month')?.value, 10) - 1;
      day = parseInt(parts.find(p => p.type === 'day')?.value, 10);
    } catch {
      year = rawDate.getFullYear();
      month = rawDate.getMonth();
      day = rawDate.getDate();
    }

    let hours = 18;
    let minutes = 0;

    if (webinar.startTime) {
      const timeStr = String(webinar.startTime).trim();
      const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (match12) {
        hours = parseInt(match12[1], 10);
        minutes = parseInt(match12[2], 10);
        const meridian = match12[3] ? match12[3].toUpperCase() : null;
        if (meridian === 'PM' && hours < 12) hours += 12;
        if (meridian === 'AM' && hours === 12) hours = 0;
      } else {
        const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (match24) {
          hours = parseInt(match24[1], 10);
          minutes = parseInt(match24[2], 10);
        }
      }
    }

    let durationMinutes = 60;
    if (webinar.duration) {
      const durMatch = String(webinar.duration).match(/(\d+(\.\d+)?)/);
      if (durMatch) {
        const val = parseFloat(durMatch[1]);
        if (/hour/i.test(webinar.duration)) {
          durationMinutes = Math.round(val * 60);
        } else {
          durationMinutes = Math.round(val);
        }
      }
    }

    const pad = (n) => String(n).padStart(2, '0');
    const isoString = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+05:30`;
    let startDateTime = new Date(isoString);
    if (isNaN(startDateTime.getTime())) {
      startDateTime = new Date(year, month, day, hours, minutes, 0);
    }

    // 15-minute grace period after scheduled duration
    const endDateTime = new Date(startDateTime.getTime() + (durationMinutes + 15) * 60 * 1000);
    const now = new Date();

    return {
      startDateTime,
      endDateTime,
      isExpired: now > endDateTime,
      isLiveNow: now >= startDateTime && now <= endDateTime
    };
  } catch (e) {
    console.error('Error calculating webinar end time:', e);
    return null;
  }
};

// ============================================================================
// PUBLIC CONTROLLER METHODS
// ============================================================================

/**
 * Get current active webinar for website popup and page.
 * Strictly excludes any webinar whose timings have passed (stale).
 * Priority: Currently isLive/LiveNow=true, then closest upcoming non-expired webinar.
 */
exports.getActiveWebinar = async (req, res) => {
  try {
    // Query active candidates
    const candidates = await Webinar.find({ isActive: true })
      .sort({ isLive: -1, startDate: 1, createdAt: -1 })
      .lean();

    const validWebinars = [];
    const expiredIds = [];

    for (const w of candidates) {
      const timing = getWebinarTimingInfo(w);
      if (timing && timing.isExpired) {
        expiredIds.push(w._id);
      } else {
        validWebinars.push({
          ...w,
          timing
        });
      }
    }

    // Auto-deactivate stale webinars in background
    if (expiredIds.length > 0) {
      Webinar.updateMany(
        { _id: { $in: expiredIds } },
        { $set: { isActive: false, isLive: false } }
      ).catch(err => console.error('Error auto-deactivating expired webinars:', err));
    }

    if (validWebinars.length === 0) {
      return res.status(200).json({
        success: true,
        webinar: null,
        message: 'No active or upcoming webinar currently scheduled'
      });
    }

    // Sort valid non-expired webinars:
    // 1. Currently live session first
    // 2. Earliest upcoming scheduled session next
    validWebinars.sort((a, b) => {
      const aLive = a.isLive || a.timing?.isLiveNow;
      const bLive = b.isLive || b.timing?.isLiveNow;
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      const aStart = a.timing?.startDateTime?.getTime() || 0;
      const bStart = b.timing?.startDateTime?.getTime() || 0;
      return aStart - bStart;
    });

    const chosen = validWebinars[0];
    const { timing, ...cleanWebinar } = chosen;

    return res.status(200).json({
      success: true,
      webinar: cleanWebinar
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
 * Returns isExpired: true and null webinar if timings have passed.
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

    const timing = getWebinarTimingInfo(webinar);
    if (timing && timing.isExpired) {
      // Auto-deactivate stale webinar in background
      if (webinar.isActive || webinar.isLive) {
        Webinar.updateOne({ _id: webinar._id }, { $set: { isActive: false, isLive: false } })
          .catch(() => {});
      }

      return res.status(200).json({
        success: true,
        isExpired: true,
        webinar: null,
        message: 'This webinar session has already concluded. Please check back for upcoming webinars!'
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

    // Check if webinar has already passed (stale)
    const timing = getWebinarTimingInfo(webinar);
    if (timing && timing.isExpired) {
      return res.status(400).json({
        success: false,
        message: 'This webinar session has already concluded. Registrations are now closed.'
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

    const enriched = webinars.map(w => {
      const timing = getWebinarTimingInfo(w);
      return {
        ...w,
        registrationCount: countMap[String(w._id)] || 0,
        isExpired: timing ? timing.isExpired : false,
        isLiveNow: timing ? timing.isLiveNow : false
      };
    });

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

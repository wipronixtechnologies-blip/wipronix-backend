const EventTest = require("../../models/EventTest.model");
const Question = require("../../models/Question.model");

// POST /api/test/create-event
const createEvent = async (req, res, next) => {
  try {
    const { collegeName, testTitle, technology, durationMinutes, questionsCount, passPercentage, eventCode } = req.body;

    if (!collegeName || !testTitle) {
      return res.status(400).json({
        success: false,
        message: "College Name and Test Title are required"
      });
    }

    const cleanCollege = collegeName.trim();
    // Auto-generate eventCode from College Name if not provided
    const generatedCode = eventCode 
      ? eventCode.trim().toUpperCase()
      : `WIP-${cleanCollege.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)}-2026`;

    // Check if event for this college already exists
    let existingEvent = await EventTest.findOne({
      $or: [{ collegeName: cleanCollege }, { eventCode: generatedCode }]
    });

    if (existingEvent) {
      existingEvent.collegeName = cleanCollege;
      existingEvent.testTitle = testTitle;
      existingEvent.technology = technology || existingEvent.technology;
      existingEvent.durationMinutes = durationMinutes || existingEvent.durationMinutes;
      existingEvent.questionsCount = questionsCount || existingEvent.questionsCount;
      existingEvent.passPercentage = passPercentage || existingEvent.passPercentage;
      await existingEvent.save();

      return res.status(200).json({
        success: true,
        message: `College event for ${cleanCollege} updated successfully`,
        data: existingEvent
      });
    }

    const newEvent = await EventTest.create({
      eventCode: generatedCode,
      collegeName: cleanCollege,
      testTitle,
      technology: technology || "General Technical & Aptitude",
      durationMinutes: durationMinutes || 20,
      questionsCount: questionsCount || 20,
      passPercentage: passPercentage || 70
    });

    res.status(201).json({
      success: true,
      message: `College event for ${cleanCollege} created successfully`,
      data: newEvent
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/test/events
const getEvents = async (req, res, next) => {
  try {
    const events = await EventTest.find().sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createEvent, getEvents };

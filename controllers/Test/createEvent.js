const EventTest = require("../../models/EventTest.model");
const Question = require("../../models/Question.model");

// Seed default ERP College Events if database is empty
const seedDefaultEvents = async () => {
  const count = await EventTest.countDocuments();
  if (count === 0) {
    const defaultDrives = [
      {
        eventCode: "WIP-TULA-2026",
        collegeName: "Tula's Institute",
        testTitle: "National Campus Talent Evaluation Drive",
        eventType: "Placement Drive",
        conductedBy: "Harish Chawla",
        maxHrMarks: 10.00,
        maxTechMarks: 10.00,
        technology: "General Technical & Aptitude",
        durationMinutes: 30
      },
      {
        eventCode: "WIP-MAIMT-2026",
        collegeName: "MAIMT, Jagadhri",
        testTitle: "Placement Drive 2026",
        eventType: "Placement Drive",
        conductedBy: "Harish Chawla",
        maxHrMarks: 10.00,
        maxTechMarks: 10.00,
        technology: "General Technical & Aptitude",
        durationMinutes: 30
      },
      {
        eventCode: "WIP-SHOBHIT-2026",
        collegeName: "Shobhit Univ, Meerut",
        testTitle: "Shobhit Deemed University Drive",
        eventType: "Placement Drive",
        conductedBy: "Harish Chawla",
        maxHrMarks: 10.00,
        maxTechMarks: 10.00,
        technology: "General Technical & Aptitude",
        durationMinutes: 30
      },
      {
        eventCode: "WIP-GPAMBOTA-2026",
        collegeName: "GP Ambota",
        testTitle: "DR. BR Ambedkar Polytechnic Drive",
        eventType: "Placement Drive",
        conductedBy: "Harish Chawla",
        maxHrMarks: 10.00,
        maxTechMarks: 10.00,
        technology: "General Technical & Aptitude",
        durationMinutes: 30
      },
      {
        eventCode: "WIP-GPKANDA-2026",
        collegeName: "GP Kandaghat",
        testTitle: "Govt. Polytechnic College Drive",
        eventType: "Placement Drive",
        conductedBy: "Harish Chawla",
        maxHrMarks: 10.00,
        maxTechMarks: 10.00,
        technology: "General Technical & Aptitude",
        durationMinutes: 30
      },
      {
        eventCode: "WIP-JNGEC-2026",
        collegeName: "JNGEC Sundernagar",
        testTitle: "Jawaharlal Nehru Govt. Engg College Drive",
        eventType: "Placement Drive",
        conductedBy: "Harish Chawla",
        maxHrMarks: 10.00,
        maxTechMarks: 10.00,
        technology: "General Technical & Aptitude",
        durationMinutes: 30
      }
    ];

    await EventTest.insertMany(defaultDrives);
    console.log("✅ Seeded default ERP placement drive events into MongoDB");
  }
};

// POST /api/test/create-event
const createEvent = async (req, res, next) => {
  try {
    const { collegeName, testTitle, technology, durationMinutes, questionsCount, passPercentage, eventCode, eventType, conductedBy, maxHrMarks, maxTechMarks } = req.body;

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
      existingEvent.eventType = eventType || existingEvent.eventType || "Placement Drive";
      existingEvent.conductedBy = conductedBy || existingEvent.conductedBy || "Harish Chawla";
      existingEvent.maxHrMarks = maxHrMarks || existingEvent.maxHrMarks || 10;
      existingEvent.maxTechMarks = maxTechMarks || existingEvent.maxTechMarks || 10;
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
      eventType: eventType || "Placement Drive",
      conductedBy: conductedBy || "Harish Chawla",
      maxHrMarks: maxHrMarks || 10.00,
      maxTechMarks: maxTechMarks || 10.00,
      technology: technology || "General Technical & Aptitude",
      durationMinutes: durationMinutes || 30,
      questionsCount: questionsCount || 30,
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
    await seedDefaultEvents();
    const events = await EventTest.find().sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/test/toggle-event-status
const toggleEventStatus = async (req, res, next) => {
  try {
    const { eventId, isActive } = req.body;
    const event = await EventTest.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }
    event.isActive = isActive;
    await event.save();
    res.json({ success: true, message: `Event marked as ${isActive ? 'Active' : 'Inactive'}`, data: event });
  } catch (error) {
    next(error);
  }
};

module.exports = { createEvent, getEvents, toggleEventStatus };

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
    console.log("Seeded default ERP placement drive events into MongoDB");
  }
};

// Smart event code generator based on college name and distinct keywords
const generateSmartEventCode = (collegeName, existingCodes = []) => {
  if (!collegeName) return `WIP-EVENT-${Date.now().toString().slice(-4)}-2026`;
  const clean = collegeName.trim();
  const words = clean.split(/[\s,.\-_/()]+/).filter(w => w.length > 0);
  const stopWords = new Set([
    'college', 'colleg', 'collge', 'institute', 'inst', 'institution',
    'university', 'univ', 'of', 'and', '&', 'the', 'for', 'in', 'at',
    'technology', 'tech', 'sciences', 'science', 'engineering', 'engg', 'eng'
  ]);
  const distinct = words.filter(w => !stopWords.has(w.toLowerCase()));
  let core = '';
  if (distinct.length >= 2) {
    const w1 = distinct[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const wLast = distinct[distinct.length - 1].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    core = (w1.slice(0, 4) + wLast.slice(0, 4)).slice(0, 8);
  } else if (distinct.length === 1) {
    core = distinct[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
  } else if (words.length > 0) {
    core = words[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
  } else {
    core = 'COLLEGE';
  }
  let baseCode = `WIP-${core}-2026`;
  if (existingCodes.includes(baseCode)) {
    let counter = 2;
    while (existingCodes.includes(`WIP-${core.slice(0, 6)}${counter}-2026`)) {
      counter++;
    }
    baseCode = `WIP-${core.slice(0, 6)}${counter}-2026`;
  }
  return baseCode;
};

// Alternate unique code generator when a collision occurs
const generateAlternateCode = (collegeName, conflictedCode, existingCodes = []) => {
  const clean = (collegeName || '').trim();
  const words = clean.split(/[\s,.\-_/()]+/).filter(w => w.length > 0);
  let altLetters = words.map(w => w[0]).join('').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (altLetters.length < 3) {
    altLetters = clean.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6);
  }
  let altCode = `WIP-${altLetters.slice(0, 7)}-2026`;
  if (altCode === conflictedCode || existingCodes.includes(altCode)) {
    let counter = 2;
    while (existingCodes.includes(`WIP-${altLetters.slice(0, 5)}${counter}-2026`) || `WIP-${altLetters.slice(0, 5)}${counter}-2026` === conflictedCode) {
      counter++;
    }
    altCode = `WIP-${altLetters.slice(0, 5)}${counter}-2026`;
  }
  return altCode;
};

// POST /api/test/create-event
const createEvent = async (req, res, next) => {
  try {
    const {
      collegeName,
      testTitle,
      technology,
      durationMinutes,
      questionsCount,
      passPercentage,
      isActive,
      eventCode,
      eventType,
      conductedBy,
      maxHrMarks,
      maxTechMarks,
      action, // 'activate_existing' | 'create_new_code' | 'change_code'
      existingEventId,
      customEventCode
    } = req.body;

    // Action 1: User chose to activate the existing matched event
    if (action === 'activate_existing') {
      let targetEvent = null;
      if (existingEventId) {
        targetEvent = await EventTest.findById(existingEventId);
      } else if (eventCode) {
        targetEvent = await EventTest.findOne({ eventCode: eventCode.trim().toUpperCase() });
      }
      if (!targetEvent) {
        return res.status(404).json({ success: false, message: "Existing event not found" });
      }
      targetEvent.isActive = true;
      await targetEvent.save();
      return res.status(200).json({
        success: true,
        message: `Existing college event for "${targetEvent.collegeName}" (${targetEvent.eventCode}) is now Active!`,
        data: targetEvent,
        activatedExisting: true
      });
    }

    if (!collegeName || !testTitle) {
      return res.status(400).json({
        success: false,
        message: "College Name and Test Title are required"
      });
    }

    const cleanCollege = collegeName.trim();
    const existingEvents = await EventTest.find({}).lean();
    const existingCodes = existingEvents.map(e => (e.eventCode || '').toUpperCase()).filter(Boolean);

    // Determine eventCode to use
    let targetCode = customEventCode
      ? customEventCode.trim().toUpperCase()
      : (eventCode ? eventCode.trim().toUpperCase() : generateSmartEventCode(cleanCollege, existingCodes));

    // If user explicitly chose to generate a new distinct event code
    if (action === 'create_new_code' || action === 'change_code') {
      if (existingCodes.includes(targetCode)) {
        targetCode = generateAlternateCode(cleanCollege, targetCode, existingCodes);
      }
    }

    // Check if an event exists for the exact same college
    const collegeMatch = existingEvents.find(
      e => (e.collegeName || '').trim().toLowerCase() === cleanCollege.toLowerCase()
    );

    // Check if another event is already using this targetCode
    const codeMatch = existingEvents.find(
      e => (e.eventCode || '').trim().toUpperCase() === targetCode
    );

    // Conflict detection: targetCode is in use by a DIFFERENT college
    if (codeMatch && (!collegeMatch || codeMatch._id.toString() !== collegeMatch._id.toString())) {
      // If action is not explicitly creating with a new code, prompt conflict modal
      if (action !== 'create_new_code' && action !== 'change_code') {
        const suggestedCode = generateAlternateCode(cleanCollege, targetCode, existingCodes);
        return res.status(200).json({
          success: false,
          conflict: true,
          message: `The event code "${targetCode}" is already active and currently matched with "${codeMatch.collegeName}".`,
          conflictData: {
            attemptedCode: targetCode,
            newCollegeName: cleanCollege,
            newTestTitle: testTitle,
            existingEvent: {
              _id: codeMatch._id,
              collegeName: codeMatch.collegeName,
              testTitle: codeMatch.testTitle,
              eventCode: codeMatch.eventCode,
              eventType: codeMatch.eventType,
              conductedBy: codeMatch.conductedBy,
              isActive: codeMatch.isActive
            },
            suggestedCode
          }
        });
      }
    }

    // If exact same college exists and user didn't request a brand new distinct event, update it
    if (collegeMatch && action !== 'create_new_code') {
      const existing = await EventTest.findById(collegeMatch._id);
      if (existing) {
        existing.testTitle = testTitle;
        existing.technology = technology || existing.technology;
        existing.durationMinutes = durationMinutes || existing.durationMinutes;
        existing.eventType = eventType || existing.eventType || "Placement Drive";
        existing.conductedBy = conductedBy || existing.conductedBy || "Harish Chawla";
        existing.maxHrMarks = maxHrMarks || existing.maxHrMarks || 10;
        existing.maxTechMarks = maxTechMarks || existing.maxTechMarks || 10;
        existing.passPercentage = passPercentage || existing.passPercentage || 70;
        if (isActive !== undefined) existing.isActive = isActive;
        if (!codeMatch || codeMatch._id.toString() === existing._id.toString()) {
          existing.eventCode = targetCode;
        }
        await existing.save();

        return res.status(200).json({
          success: true,
          message: `College event for "${cleanCollege}" updated successfully`,
          data: existing
        });
      }
    }

    // Otherwise create a new event! Ensure uniqueness of targetCode
    while (await EventTest.exists({ eventCode: targetCode })) {
      targetCode = generateAlternateCode(cleanCollege, targetCode, existingCodes);
      existingCodes.push(targetCode);
    }

    const newEvent = await EventTest.create({
      eventCode: targetCode,
      collegeName: cleanCollege,
      testTitle,
      eventType: eventType || "Placement Drive",
      conductedBy: conductedBy || "Harish Chawla",
      maxHrMarks: maxHrMarks || 10.00,
      maxTechMarks: maxTechMarks || 10.00,
      technology: technology || "General Technical & Aptitude",
      durationMinutes: durationMinutes || 30,
      questionsCount: questionsCount || 30,
      passPercentage: passPercentage || 70,
      isActive: isActive !== undefined ? isActive : false
    });

    res.status(201).json({
      success: true,
      message: `College event for "${cleanCollege}" created successfully with code ${targetCode}`,
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

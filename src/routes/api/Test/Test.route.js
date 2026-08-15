const express = require("express");
const router = express.Router();

const startTest = require("../../../../controllers/Test/startTest");
const fetchQuestion = require("../../../../controllers/Test/fetchQuestion");
const submitAnswer = require("../../../../controllers/Test/submitAnswer");
const submitTest = require("../../../../controllers/Test/submitTest");
const addQuestion = require("../../../../controllers/Test/addQuestion");
const getTestResults = require("../../../../controllers/Test/getTestResults");
const { createEvent, getEvents } = require("../../../../controllers/Test/createEvent");

// POST /api/test/start & /api/test/public-start
router.post("/start", startTest);
router.post("/public-start", startTest);

// Event creation & listing
router.post("/create-event", createEvent);
router.get("/events", getEvents);

// Add question route
router.post("/add-question", addQuestion);

// GET /api/test/question
router.get("/question", fetchQuestion);

// POST /api/test/answer
router.post("/answer", submitAnswer);

// POST /api/test/submit (Student submits test)
router.post("/submit", submitTest);

// GET /api/test/results - Get test results with filters (for admin panel)
router.get("/results", getTestResults);

module.exports = router;

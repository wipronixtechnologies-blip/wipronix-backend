const express = require("express");
const router = express.Router();

const startTest = require("../../../../controllers/Test/startTest");
const fetchQuestion = require("../../../../controllers/Test/fetchQuestion");
const submitAnswer = require("../../../../controllers/Test/submitAnswer");
const checkTestExpiry = require("../../../middlewares/checkTestExpiry");
const submitTest = require("../../../../controllers/Test/submitTest");
const addQuestion = require("../../../../controllers/Test/addQuestion");
const getTestResults = require("../../../../controllers/Test/getTestResults");

// POST /api/test/start
router.post("/start", startTest);

// Add question route (no authentication required for now, but should be added in production)
router.post("/add-question", addQuestion);

// GET /api/test/question - Allow question fetching without active session
router.get("/question", fetchQuestion);

// POST /api/test/answer - Allow answer submission without mandatory active session check
router.post("/answer", submitAnswer);

// GET /api/test/results - Get test results with filters (for admin panel)
router.get("/results", getTestResults);

// These routes require active test session
router.use(checkTestExpiry);

router.post("/submit", submitTest);


module.exports = router;

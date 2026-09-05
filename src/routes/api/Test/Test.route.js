const express = require("express");
const router = express.Router();

const startTest = require("../../../../controllers/Test/startTest");
const fetchQuestion = require("../../../../controllers/Test/fetchQuestion");
const submitAnswer = require("../../../../controllers/Test/submitAnswer");
const submitTest = require("../../../../controllers/Test/submitTest");
const addQuestion = require("../../../../controllers/Test/addQuestion");
const { getTestResults, toggleShortlist, getShortlistedStudents, updateInterviewMarks, toggleSelection, sendStudentOfferLetter, generateStudentOfferLetterDownload } = require("../../../../controllers/Test/getTestResults");

const { createEvent, getEvents, toggleEventStatus } = require("../../../../controllers/Test/createEvent");
const { getAllQuestions, updateQuestion, deleteQuestion } = require("../../../../controllers/Test/manageQuestions");
const {
  getMachineRoundConfig,
  startMachineSession,
  runCode,
  submitMachineRound,
  toggleTechnologyRound,
  getAdminChallenges,
  saveAdminChallenge,
  deleteAdminChallenge,
  getCandidateSubmission
} = require("../../../../controllers/Test/machineRoundController");

// POST /api/test/start & /api/test/public-start
router.post("/start", startTest);
router.post("/public-start", startTest);

// Event creation & listing
router.post("/create-event", createEvent);
router.get("/events", getEvents);
router.post("/toggle-event-status", toggleEventStatus);

// Question Bank CRUD routes
router.get("/all-questions", getAllQuestions);
router.post("/add-question", addQuestion);
router.put("/question/:id", updateQuestion);
router.delete("/question/:id", deleteQuestion);

// GET /api/test/question
router.get("/question", fetchQuestion);

// POST /api/test/answer
router.post("/answer", submitAnswer);

// POST /api/test/submit (Student submits test)
router.post("/submit", submitTest);

// ---------------- MACHINE ROUND / CODING PLATFORM ROUTES ----------------
router.get("/machine-round/config", getMachineRoundConfig);
router.post("/machine-round/start", startMachineSession);
router.post("/machine-round/run", runCode);
router.post("/machine-round/submit", submitMachineRound);
router.post("/machine-round/toggle-tech", toggleTechnologyRound);
router.get("/machine-round/admin/challenges", getAdminChallenges);
router.post("/machine-round/admin/challenge", saveAdminChallenge);
router.delete("/machine-round/admin/challenge/:id", deleteAdminChallenge);
router.get("/machine-round/submission/:resultId", getCandidateSubmission);

// Test results & shortlist management
router.get("/results", getTestResults);
router.post("/toggle-shortlist", toggleShortlist);
router.get("/shortlisted-students", getShortlistedStudents);
router.post("/update-interview-marks", updateInterviewMarks);
router.post("/toggle-selection", toggleSelection);
router.post("/send-student-offer-letter", sendStudentOfferLetter);
router.get("/generate-student-offer-letter/:resultId", generateStudentOfferLetterDownload);

module.exports = router;


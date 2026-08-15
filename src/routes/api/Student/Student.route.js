const express = require("express");
const router = express.Router();
const multer = require('multer');

const registerStudent = require("../../../../controllers/Student/registerStudent");
const getAllStudents = require("../../../../controllers/Student/getAllStudents");
const { authenticateStaff } = require("../../../../controllers/Auth/staffProfile");
const getStudentByEmail = require("../../../../controllers/Student/getStudentByEmail");
const updateStudentByEmail = require("../../../../controllers/Student/updateStudentByEmail");
const updateStudentWithProfilePicture = require("../../../../controllers/Student/updateStudentWithProfilePicture");

// Configure multer for profile picture upload
const storage = multer.memoryStorage();
const profilePictureUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'), false);
    }
  }
});

// POST /api/student/register
router.post("/register", registerStudent);

// GET /api/student/all - Get all students (Staff only)
router.get("/all", authenticateStaff, getAllStudents);

// GET /api/student/by-email?email=example@gmail.com
router.get("/by-email", getStudentByEmail);

// PUT /api/student/by-email (basic update without file upload)
router.put("/by-email", updateStudentByEmail);

// PUT /api/student/update-profile (update with profile picture upload)
router.put("/update-profile", profilePictureUpload.single('profilePicture'), updateStudentWithProfilePicture);

module.exports = router;

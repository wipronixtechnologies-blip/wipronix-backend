const express = require("express");
const router = express.Router();
const multer = require('multer');

const registerStudent = require("../../../../controllers/Student/registerStudent");
const getAllStudents = require("../../../../controllers/Student/getAllStudents");
const { authenticateStaff } = require("../../../../controllers/Auth/staffProfile");
const authenticate = require("../../../middlewares/auth");
const getStudentByEmail = require("../../../../controllers/Student/getStudentByEmail");
const updateStudentByEmail = require("../../../../controllers/Student/updateStudentByEmail");
const updateStudentWithProfilePicture = require("../../../../controllers/Student/updateStudentWithProfilePicture");
const { bulkUpload, checkDuplicates } = require("../../../../controllers/Student/bulkUpload");
const { deleteStudentByEmail, bulkDeleteStudents } = require("../../../../controllers/Student/deleteStudent");

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
router.get("/by-email", authenticate, getStudentByEmail);

// PUT /api/student/by-email (basic update without file upload)
router.put("/by-email", authenticate, updateStudentByEmail);

// DELETE /api/student/by-email (Delete student lead by email or ID)
router.delete("/by-email", authenticateStaff, deleteStudentByEmail);

// POST /api/student/check-duplicates (pre-check duplicates before bulk import)
router.post("/check-duplicates", authenticateStaff, checkDuplicates);

// POST /api/student/bulk (bulk upload array of students)
router.post("/bulk", authenticateStaff, bulkUpload);

// POST /api/student/bulk-delete (bulk delete students by IDs or emails)
router.post("/bulk-delete", authenticateStaff, bulkDeleteStudents);

// DELETE /api/student/bulk (bulk delete students by IDs or emails)
router.delete("/bulk", authenticateStaff, bulkDeleteStudents);

// PUT /api/student/update-profile (update with profile picture upload)
router.put("/update-profile", authenticate, profilePictureUpload.single('profilePicture'), updateStudentWithProfilePicture);

module.exports = router;

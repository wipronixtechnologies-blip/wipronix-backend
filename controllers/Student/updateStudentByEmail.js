const bcrypt = require("bcryptjs");
const Student = require("../../models/Student.model");

const updateStudentByEmail = async (req, res, next) => {
  try {
    const { email, ...updateData } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required for updating student"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Check if student exists
    const existingStudent = await Student.findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found with this email address"
      });
    }

    // Prepare update data (only allow specific fields to be updated)
    const allowedFields = [
      'fullName', 'phoneNumber', 'city', 'education', 
      'course', 'college', 'passingYear', 'password', 'isVerified'
    ];

    const filteredUpdateData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined && updateData[key] !== '') {
        filteredUpdateData[key] = updateData[key];
      }
    });

    // Always set isVerified to true when updating student information
    filteredUpdateData.isVerified = true;

    // Hash password if provided
    if (filteredUpdateData.password) {
      if (filteredUpdateData.password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long"
        });
      }
      
      // Hash the password using bcrypt
      const saltRounds = 12;
      try {
        const hashedPassword = await bcrypt.hash(filteredUpdateData.password, saltRounds);
        filteredUpdateData.password = hashedPassword;
      } catch (hashError) {
        console.error('Password hashing error:', hashError);
        return res.status(500).json({
          success: false,
          message: "Error processing password. Please try again."
        });
      }
    }

    // Update student
    const updatedStudent = await Student.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      filteredUpdateData,
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-password -resetPasswordToken -resetPasswordExpires');

    res.status(200).json({
      success: true,
      message: "Student details updated successfully",
      data: {
        student: updatedStudent
      }
    });

  } catch (error) {
    console.error('Update student by email error:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error while updating student details"
    });
  }
};

module.exports = updateStudentByEmail;

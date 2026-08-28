const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Student = require("../../models/Student.model");
const { registerSchema } = require("../../src/services/validationSchema");

const register = async (request, response, next) => {
  try {
    // Validate input using Joi
    const validatedData = await registerSchema.validateAsync(request.body);

    const {
      fullName,
      email,
      password,
      confirmPassword,
      phoneNumber,
      city,
      education,
      course,
      college,
      passingYear,
    } = validatedData;

    // Check if student already exists
    const existingStudent = await Student.findOne({
      $or: [{ email: email.toLowerCase() }, { phoneNumber: phoneNumber }],
    });

    if (existingStudent) {
      if (existingStudent.password) {
        return response.status(400).json({
          success: false,
          message: "User with this email or phone number already exists",
        });
      }

      // Complete registration on existing record
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      existingStudent.fullName = fullName.trim();
      existingStudent.email = email.toLowerCase().trim();
      existingStudent.password = hashedPassword;
      existingStudent.phoneNumber = phoneNumber.trim();
      existingStudent.city = city.trim();
      existingStudent.education = education;
      existingStudent.course = course;
      existingStudent.college = college.trim();
      existingStudent.passingYear = passingYear;
      existingStudent.isVerified = true;

      const savedStudent = await existingStudent.save();

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: savedStudent._id,
          studentId: savedStudent._id,
          email: savedStudent.email,
          userType: savedStudent.userType || "Student",
        },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "7d" }
      );

      // Set cookie with token
      const isProd = process.env.NODE_ENV === 'production';
      response.cookie("token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      const studentResponse = {
        _id: savedStudent._id,
        fullName: savedStudent.fullName,
        email: savedStudent.email,
        phoneNumber: savedStudent.phoneNumber,
        city: savedStudent.city,
        education: savedStudent.education,
        course: savedStudent.course,
        college: savedStudent.college,
        passingYear: savedStudent.passingYear,
        isVerified: savedStudent.isVerified,
        createdAt: savedStudent.createdAt,
      };

      return response.status(200).json({
        success: true,
        message: "Registration completed successfully",
        data: {
          student: studentResponse,
          token,
        },
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new student
    const newStudent = new Student({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phoneNumber: phoneNumber.trim(),
      city: city.trim(),
      education,
      course,
      college: college.trim(),
      passingYear,
    });

    // Save to database
    const savedStudent = await newStudent.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        studentId: savedStudent._id,
        email: savedStudent.email,
        userType: savedStudent.userType,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Set cookie with token
    const isProd = process.env.NODE_ENV === 'production';
    response.cookie("token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return success response (exclude password)
    const studentResponse = {
      _id: savedStudent._id,
      fullName: savedStudent.fullName,
      email: savedStudent.email,
      phoneNumber: savedStudent.phoneNumber,
      city: savedStudent.city,
      education: savedStudent.education,
      course: savedStudent.course,
      college: savedStudent.college,
      passingYear: savedStudent.passingYear,
      isVerified: savedStudent.isVerified,
      createdAt: savedStudent.createdAt,
    };

    response.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        student: studentResponse,
        token,
      },
    });
  } catch (error) {
    // Handle duplicate key error (email/phone already exists)
    if (error.code === 11000) {
      return response.status(400).json({
        success: false,
        message: "User with this email or phone number already exists",
      });
    }

    // Handle Joi validation errors
    if (error.isJoi) {
      return response.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map(detail => detail.message)
      });
    }

    // Handle Mongoose validation errors
    if (error.name === "ValidationError" && error.errors) {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return response.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors,
      });
    }

    console.error("Registration error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error during registration",
    });
  }
};

module.exports = register;

const Router = require("express").Router();
const register = require('../../../controllers/Auth/register')
const login = require('../../../controllers/Auth/login')
const logout = require('../../../controllers/Auth/logout')
const getProfile = require('../../../controllers/Auth/profile')
const forgotPassword = require('../../../controllers/Auth/forgotPassword')
const resetPassword = require('../../../controllers/Auth/resetPassword')
const sendOTP = require('../../../controllers/Auth/sendOTP')
const verifyOTP = require('../../../controllers/Auth/verifyOTP')
const otpResetPassword = require('../../../controllers/Auth/otpResetPassword')
const authenticate = require('../../middlewares/auth')

// Student Authentication Routes
Router.post("/register", register)
Router.post("/login", login)
Router.post("/logout", logout)
Router.get("/profile", authenticate, getProfile)
Router.post("/forgot-password", forgotPassword)
Router.post("/reset-password", resetPassword)
Router.post("/send-otp", sendOTP)
Router.post("/verify-otp", verifyOTP)
Router.post("/otp-reset-password", otpResetPassword)

// Staff Authentication Routes (Role-based: Super Admin, Admin, Staff, Employee)
const staffLogin = require('../../../controllers/Auth/staffLogin')
const staffRegister = require('../../../controllers/Auth/staffRegister')
const staffLogout = require('../../../controllers/Auth/staffLogout')
const staffProfile = require('../../../controllers/Auth/staffProfile')
const staffForgotPassword = require('../../../controllers/Auth/staffForgotPassword')
const staffSendOTP = require('../../../controllers/Auth/staffSendOTP')
const staffVerifyOTP = require('../../../controllers/Auth/staffVerifyOTP')
const staffOtpResetPassword = require('../../../controllers/Auth/staffOtpResetPassword')
const { authenticateStaff, authorize } = require('../../../controllers/Auth/staffProfile')

// Staff auth routes
Router.post("/staff/login", staffLogin)
Router.post("/staff/register", staffRegister)
Router.post("/staff/logout", staffLogout)
Router.get("/staff/profile", authenticateStaff, staffProfile.getStaffProfile)
Router.put("/staff/profile", authenticateStaff, staffProfile.updateStaffProfile)

// Staff Password Reset Routes
Router.post("/staff/forgot-password", staffForgotPassword)
Router.post("/staff/send-otp", staffSendOTP)
Router.post("/staff/verify-otp", staffVerifyOTP)
Router.post("/staff/otp-reset-password", staffOtpResetPassword)

// Example of role-protected route
// Router.get("/admin/dashboard", authenticateStaff, authorize('super_admin', 'admin'), (req, res) => {
//   res.json({ message: "Admin dashboard data" })
// })

module.exports = Router;

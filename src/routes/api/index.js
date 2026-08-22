const Router = require("express").Router();
const auth = require('./Auth.route')
const studentRoutes = require('./Student/Student.route')
const testRoutes = require('./Test/Test.route')
const internshipRoutes = require('./Internship.route')
const imageRoutes = require('./Image/Image.route')
const staffRoutes = require('./Staff.route')
const collegeRoutes = require('./College/College.route')
const broadcastRoutes = require('../../../routes/Broadcast/Broadcast.route')
const attendanceRoutes = require('../../../routes/Attendance/Attendance.route')
const leaveRoutes = require('../../../routes/Leave/Leave.route')
const activityRoutes = require('./Activity.route')
const messageRoutes = require('../../../routes/Message/messageRoutes')
const ticketRoutes = require('./Ticket.route')
const documentRoutes = require('./Document.route')
const performanceRoutes = require('./Performance.route')
const notificationRoutes = require('./Notification.route')
const developmentRoutes = require('./Development.route')
const resignationRoutes = require('./Resignation.route')
const courseRoutes = require('./Course.route')
const trainerRoutes = require('./Trainer.route')
const financeRoutes = require('./Finance.route')

Router.use('/auth',auth)
Router.use("/student", studentRoutes);
Router.use("/test", testRoutes);
Router.use("/internship", internshipRoutes);
Router.use("/image", imageRoutes);
Router.use("/staff", staffRoutes);
Router.use("/college", collegeRoutes);
Router.use("/broadcast", broadcastRoutes);
Router.use("/attendance", attendanceRoutes);
Router.use("/leave", leaveRoutes);
Router.use("/activities", activityRoutes);
Router.use("/message", messageRoutes);
Router.use("/tickets", ticketRoutes);
Router.use("/documents", documentRoutes);
Router.use("/performance", performanceRoutes);
Router.use("/notifications", notificationRoutes);
Router.use("/development", developmentRoutes);
Router.use("/resignations", resignationRoutes);
Router.use("/courses", courseRoutes);
Router.use("/trainers", trainerRoutes);
Router.use("/finance", financeRoutes);
const settingsRoutes = require('./Settings.route');
const highestEducationRoutes = require('./HighestEducation.route');
const courseOptionRoutes = require('./CourseOption.route');
const passingYearRoutes = require('./PassingYear.route');
const marketingRoutes = require('./Marketing.route');
const bidderRoutes = require('./Bidder.route');
const placementRoutes = require('./Placement.route');
const admissionRoutes = require('./Admission.route');
const adminRoutes = require('./Admin.route');
Router.use("/settings", settingsRoutes);
Router.use("/highest-education", highestEducationRoutes);
Router.use("/course-options", courseOptionRoutes);
Router.use("/passing-years", passingYearRoutes);
Router.use("/marketing", marketingRoutes);
Router.use("/bidder", bidderRoutes);
Router.use("/placement", placementRoutes);
Router.use("/admission", admissionRoutes);
Router.use("/admin", adminRoutes);

module.exports = Router;

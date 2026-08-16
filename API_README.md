# Wipronix API Documentation

This document provides a comprehensive overview of the REST APIs available in the Wipronix backend, grouped by their core modules.

## 1. Authentication & Authorization (`/api/auth`)
Handles user and staff login, registration, password resets, and session management.

| Method | Endpoint | Functionality |
|--------|----------|---------------|
| `POST` | `/register` | Register a new user |
| `POST` | `/login` | Authenticate a user |
| `POST` | `/logout` | Invalidate user session |
| `GET`  | `/profile` | Retrieve the authenticated user's profile |
| `POST` | `/forgot-password` | Initiate password reset process |
| `POST` | `/reset-password` | Reset password using a secure token |
| `POST` | `/send-otp` | Send an OTP for verification |
| `POST` | `/verify-otp` | Verify the sent OTP |
| `POST` | `/staff/login` | Authenticate a staff member |
| `POST` | `/staff/register` | Register a new staff member |
| `GET`  | `/staff/profile` | Retrieve the authenticated staff profile |

## 2. Task Management (`/api/tasks` or `/tasks`)
APIs for assigning, tracking, and updating employee tasks.

| Method | Endpoint | Functionality |
|--------|----------|---------------|
| `GET`  | `/my-tasks` | Get tasks assigned to the current user |
| `GET`  | `/assigned-tasks` | Get tasks assigned by the current user to others |
| `GET`  | `/stats` | Retrieve statistics regarding task completion |
| `POST` | `/` | Create and assign a new task |
| `PUT`  | `/:id` | Update task details |
| `PATCH`| `/:id/status` | Update the progress status of a task |
| `DELETE`| `/:id` | Remove a task |

## 3. Leave Management (`/api/leave` or `/leave`)
Handles employee leave applications, balances, and HR approvals.

| Method | Endpoint | Functionality |
|--------|----------|---------------|
| `GET`  | `/my/balance` | Get the logged-in user's leave balance |
| `GET`  | `/my` | Get a history of user's leave applications |
| `POST` | `/apply` | Submit a new leave application |
| `DELETE`| `/cancel/:id` | Cancel a pending leave application |
| `GET`  | `/pending` | (HR/Admin) View pending leave requests |
| `PATCH`| `/approve/:id` | (HR/Admin) Approve a leave request |
| `PATCH`| `/reject/:id` | (HR/Admin) Reject a leave request |

## 4. Messaging & Communication (`/api/messages` or `/message`)
Internal messaging system for staff.

| Method | Endpoint | Functionality |
|--------|----------|---------------|
| `GET`  | `/conversations` | Retrieve active conversations for the user |
| `GET`  | `/conversations/:id/messages` | Fetch messages in a specific conversation |
| `POST` | `/send` | Send a direct message |
| `PATCH`| `/conversations/:id/read` | Mark all messages in a conversation as read |
| `GET`  | `/unread-count` | Retrieve the total unread message count |

## 5. Broadcasts & Announcements (`/api/broadcast` or `/broadcast`)
System-wide or group-specific announcements.

| Method | Endpoint | Functionality |
|--------|----------|---------------|
| `POST` | `/` | Create a new broadcast announcement |
| `GET`  | `/` | Retrieve all broadcasts |
| `GET`  | `/active` | Retrieve only currently active broadcasts |
| `GET`  | `/stats` | Retrieve broadcast reach/read statistics |
| `PATCH`| `/:id/toggle` | Toggle the active status of an announcement |

## 6. Attendance & Resignations (`/api/attendance`, `/api/resignation`)
Track daily attendance and manage offboarding.

| Method | Endpoint | Functionality |
|--------|----------|---------------|
| `POST` | `/punch-in` | Record start of shift time |
| `POST` | `/punch-out` | Record end of shift time |
| `GET`  | `/status` | Get current attendance status for today |
| `GET`  | `/all` | (Admin) Get attendance records for all staff |
| `POST` | `/api/resignation` | Submit a resignation request |
| `GET`  | `/api/resignation/my` | Track user's own resignation status |
| `PUT`  | `/api/resignation/:id` | (HR/Admin) Update the status of a resignation |

## 7. Admission & Students (`/api/admission`, `/api/student`)
Management of student data, fees, and enrollments.

| Method | Endpoint | Functionality |
|--------|----------|---------------|
| `GET`  | `/overview` | Get an overview of admission stats |
| `GET`  | `/students` | Get list of admitted students |
| `POST` | `/student` | Enroll a new student |
| `GET`  | `/fees` | Retrieve fee payment records |
| `POST` | `/fee` | Record a new fee payment |

## 8. Courses & Colleges (`/api/course`, `/api/college`)
Academic program and affiliated institution management.

| Method | Endpoint | Functionality |
|--------|----------|---------------|
| `GET`  | `/` | Retrieve all courses/colleges |
| `GET`  | `/:id` | Retrieve details for a specific course/college |
| `POST` | `/` | Create a new course/college entry |
| `PUT`  | `/:id` | Update details of a course/college |
| `DELETE`| `/:id` | Remove a course/college record |

## 9. Admin & Bidding (`/api/admin`, `/api/bidder`)
Higher-level organization overview and proposal generation.

| Method | Endpoint | Functionality |
|--------|----------|---------------|
| `GET`  | `/overview` | (Admin) Fetch high-level organization statistics |
| `GET`  | `/approvals` | (Admin) Fetch all items pending admin approval |
| `GET`  | `/proposals` | Get list of bidding proposals |
| `POST` | `/proposals` | Create a new business proposal |
| `PUT`  | `/proposals/:id/handover` | Handover a proposal to another team |

---
*Note: Some modules have additional endpoints not listed here. This documentation provides the primary CRUD and functional endpoints as extracted from the backend route files.*

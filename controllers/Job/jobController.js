const Job = require('../../models/Job.model');
const JobApplication = require('../../models/JobApplication.model');
const storageService = require('../../src/services/storageService');
const multer = require('multer');
const nodemailer = require('nodemailer');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'), false);
    }
  }
}).single('resume');

// Create Transporter for Gmail SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'your-email@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password'
    }
  });
};

// Candidate confirmation email template
const sendCandidateEmail = async (candidateName, email, jobTitle) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.GMAIL_USER || 'your-email@gmail.com',
      to: email,
      subject: `Application Received - ${jobTitle} at Wipronix`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #ab1428, #7f0d1d); padding: 24px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 22px;">Wipronix Careers</h2>
            <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Thank you for your application</p>
          </div>
          <div style="padding: 24px; color: #374151; line-height: 1.6;">
            <p>Dear <strong>${candidateName}</strong>,</p>
            <p>Thank you for submitting your application for the <strong>${jobTitle}</strong> position at Wipronix.</p>
            <p>We appreciate your interest in joining our team. Our recruitment team is currently reviewing all submissions. If your qualifications match our requirements, we will reach out to you within 3-5 business days to discuss the next steps.</p>
            <div style="background-color: #f9fafb; border-left: 4px solid #ab1428; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; font-weight: bold;">Application Summary:</p>
              <ul style="margin: 8px 0 0; padding-left: 20px;">
                <li><strong>Position:</strong> ${jobTitle}</li>
                <li><strong>Status:</strong> Under Review</li>
              </ul>
            </div>
            <p>Best of luck with your job search!</p>
            <p>Warm regards,</p>
            <p><strong>Wipronix HR Team</strong><br>Human Resources & Talent Acquisition</p>
          </div>
          <div style="background-color: #f3f4f6; padding: 12px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0;">© 2026 Wipronix. All rights reserved.</p>
          </div>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
    console.log(`Job confirmation email sent successfully to ${email}`);
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
  }
};

// ==========================================
// PUBLIC JOB ENDPOINTS (For Candidates)
// ==========================================

// Get active job listings
exports.getActiveJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ status: 'Active' }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: jobs
    });
  } catch (error) {
    console.error('Error fetching active jobs:', error);
    next(error);
  }
};

// Get single job details
exports.getJobDetails = async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, status: 'Active' });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job listing not found or is no longer active'
      });
    }
    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error fetching job details:', error);
    next(error);
  }
};

// Apply to a job (Candidate)
exports.applyForJob = async (req, res, next) => {
  try {
    const { jobId, fullName, email, phone, coverLetter, experience } = req.body;
    if (!jobId || !fullName || !email || !phone || !experience) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    }

    // Check if job exists and is active
    const job = await Job.findOne({ _id: jobId, status: 'Active' });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job listing not found or is closed' });
    }

    // Check if candidate already applied for this job
    const existingApplication = await JobApplication.findOne({ email, jobId });
    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted an application for this position'
      });
    }

    const application = new JobApplication({
      jobId,
      fullName,
      email,
      phone,
      coverLetter: coverLetter || '',
      experience,
      status: 'Pending'
    });

    await application.save();

    // Send confirmation email asynchronously
    sendCandidateEmail(fullName, email, job.title);

    res.status(201).json({
      success: true,
      message: 'Your application has been submitted successfully!',
      data: application
    });
  } catch (error) {
    console.error('Error applying for job:', error);
    next(error);
  }
};

// ==========================================
// ADMIN JOB ENDPOINTS (For HR/Admins)
// ==========================================

// Get all jobs (includes drafts and closed)
exports.getAdminJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({}).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: jobs
    });
  } catch (error) {
    console.error('Error fetching admin jobs:', error);
    next(error);
  }
};

// Create a job posting
exports.createJob = async (req, res, next) => {
  try {
    const { title, department, location, type, experience, salaryRange, description, requirements, responsibilities, status } = req.body;
    
    if (!title || !department || !location || !experience || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const newJob = new Job({
      title,
      department,
      location,
      type: type || 'Full-time',
      experience,
      salaryRange: salaryRange || 'Negotiable',
      description,
      requirements: requirements || [],
      responsibilities: responsibilities || [],
      status: status || 'Active',
      postedBy: req.staff._id
    });

    await newJob.save();

    res.status(201).json({
      success: true,
      message: 'Job posting created successfully',
      data: newJob
    });
  } catch (error) {
    console.error('Error creating job:', error);
    next(error);
  }
};

// Update a job posting
exports.updateJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, department, location, type, experience, salaryRange, description, requirements, responsibilities, status } = req.body;

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job listing not found'
      });
    }

    job.title = title || job.title;
    job.department = department || job.department;
    job.location = location || job.location;
    job.type = type || job.type;
    job.experience = experience || job.experience;
    job.salaryRange = salaryRange || job.salaryRange;
    job.description = description || job.description;
    job.requirements = requirements || job.requirements;
    job.responsibilities = responsibilities || job.responsibilities;
    job.status = status || job.status;

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job posting updated successfully',
      data: job
    });
  } catch (error) {
    console.error('Error updating job:', error);
    next(error);
  }
};

// Delete a job posting
exports.deleteJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job listing not found'
      });
    }

    // Delete all applications corresponding to this job (optional, but clean DB design)
    // We can extract resume paths and delete them from firebase first!
    const applications = await JobApplication.find({ jobId: id });
    for (const app of applications) {
      if (app.resumePath) {
        await storageService.deleteFile(app.resumePath);
      }
    }
    await JobApplication.deleteMany({ jobId: id });

    await Job.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Job posting and associated applications deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    next(error);
  }
};

// Get all applications (Admin/HR)
exports.getApplications = async (req, res, next) => {
  try {
    const { jobId } = req.query;
    const filter = {};
    if (jobId) {
      filter.jobId = jobId;
    }

    const applications = await JobApplication.find(filter)
      .populate('jobId', 'title department')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    next(error);
  }
};

// Update application status (Admin/HR)
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Reviewed', 'Shortlisted', 'Rejected', 'Hired'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application status value'
      });
    }

    const application = await JobApplication.findById(id).populate('jobId', 'title');
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Job application not found'
      });
    }

    application.status = status;
    await application.save();

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status} successfully`,
      data: application
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    next(error);
  }
};

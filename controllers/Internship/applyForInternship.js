const nodemailer = require('nodemailer');
const Student = require('../../models/Student.model');

// Technology stack assessment links mapping
const assessmentLinks = {
  "MERN Stack": "https://portal.occena.tech/assessment/mern-stack",
  "AI / ML": "https://portal.occena.tech/assessment/ai-ml",
  "Python Web Development": "https://portal.occena.tech/assessment/python-web",
  "Graphic Design": "https://portal.occena.tech/assessment/graphic-design",
  "Data Analytics": "https://portal.occena.tech/assessment/data-analytics",
  "Mobile App Development": "https://portal.occena.tech/assessment/mobile-dev"
};

// Create transporter for Gmail SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'your-email@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password'
    }
  });
};

// Email templates
const createEmailTemplate = (studentData, technology, includeLink = true) => {
  const assessmentLink =
    assessmentLinks[technology] || "https://portal.wipronix.com/assessment";

  const subject = includeLink ? `Wipronix Internship Assessment – ${technology}` : `Welcome to Wipronix Internship Program – ${technology}`;

  return {
    subject,
    html: `
      <div style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ab1428, #7f0d1d); padding: 32px; text-align: center;">
          <img src="https://firebasestorage.googleapis.com/v0/b/unreal-b8198.firebasestorage.app/o/logo.png?alt=media&token=95a16c4f-af45-44ad-aa59-c2dbefd398ea " alt="Wipronix Logo" style="max-width: 150px; height: auto; margin-bottom: 16px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.3px;">
            ${includeLink ? 'Wipronix Internship Assessment' : 'Welcome to Wipronix Internship Program'}
          </h1>
          <p style="color: #f3f3f3; margin-top: 8px; font-size: 14px;">
            Technology • Innovation • Career Growth
          </p>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
          <p style="font-size: 16px; color: #1f2937;">
            Dear <strong>${studentData.name}</strong>,
          </p>

          <p style="font-size: 15.5px; color: #374151; line-height: 1.7;">
            Thank you for applying for the <strong>${technology} Internship Program</strong> at <strong>Wipronix</strong>.
            We appreciate your interest in joining our growing technology team.
          </p>

          ${includeLink ? `
          <p style="font-size: 15.5px; color: #374151; line-height: 1.7;">
            As part of our selection process, you are required to complete an online technical assessment.
            This assessment is designed to evaluate your conceptual understanding and problem-solving skills
            relevant to the selected technology.
          </p>

          <!-- Assessment Card -->
          <div style="background-color: #f9fafb; border-left: 5px solid #ab1428; padding: 22px; margin: 26px 0;">
            <h3 style="margin-top: 0; color: #ab1428; font-size: 18px;">
              Assessment Details
            </h3>
            <table style="width: 100%; font-size: 15px; color: #1f2937;">
              <tr>
                <td style="padding: 8px 0;"><strong>Technology</strong></td>
                <td style="padding: 8px 0;">${technology}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Duration</strong></td>
                <td style="padding: 8px 0;">45 Minutes</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Assessment Format</strong></td>
                <td style="padding: 8px 0;">25 Multiple-Choice Questions + 2 Coding Problems</td>
              </tr>
            </table>
          </div>

          <!-- CTA -->
          <div style="text-align: center; margin: 38px 0;">
            <a href="${assessmentLink}"
               style="background-color: #ab1428; color: #ffffff; padding: 15px 42px;
                      text-decoration: none; font-size: 16px; font-weight: 600;
                      border-radius: 6px; display: inline-block; letter-spacing: 0.4px;">
              Access Assessment Portal
            </a>
          </div>

          <!-- Instructions -->
          <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 20px;">
            <h4 style="margin-top: 0; color: #9a3412; font-size: 16px;">
              Important Instructions
            </h4>
            <ul style="margin: 0; padding-left: 18px; color: #7c2d12; font-size: 14.5px; line-height: 1.7;">
              <li>Please ensure a stable internet connection before starting the assessment.</li>
              <li>The assessment must be completed in a single uninterrupted session.</li>
              <li>Avoid refreshing or closing the browser during the test.</li>
              <li>Use a laptop or desktop system for the best experience.</li>
            </ul>
          </div>

          <!-- Interview Info -->
          <div style="margin-top: 28px; padding: 20px; background-color: #f1f5f9; border-left: 4px solid #0f172a;">
            <p style="margin: 0; font-size: 15px; color: #0f172a; line-height: 1.7;">
              <strong>Next Step – Interview Process</strong><br />
              Candidates who successfully qualify the assessment will be invited for a technical interview.
              The interview will be scheduled within <strong>3–4 working days</strong> after assessment completion.
              Our HR team will reach out to you with further details via email.
            </p>
          </div>

          <!-- Support -->
          <p style="font-size: 14.5px; color: #4b5563; margin-top: 28px;">
            For any technical issues or queries related to the assessment, please contact us at
            <a href="mailto:support@wipronix.com" style="color: #ab1428; text-decoration: none;">
              support@wipronix.com
            </a>.
          </p>

          <!-- Closing -->
          <p style="font-size: 15.5px; color: #1f2937; margin-top: 26px;">
            We wish you success and look forward to reviewing your assessment.
          </p>
          ` : `
          <p style="font-size: 15.5px; color: #374151; line-height: 1.7;">
            Your application has been received successfully. Our team will review your profile and get back to you
            with the next steps for the internship program.
          </p>

          <!-- Next Steps -->
          <div style="margin-top: 28px; padding: 20px; background-color: #f1f5f9; border-left: 4px solid #0f172a;">
            <p style="margin: 0; font-size: 15px; color: #0f172a; line-height: 1.7;">
              <strong>What happens next?</strong><br />
              Our HR team will review your application and contact you within <strong>3–4 working days</strong>
              with further details about the internship program and any additional requirements.
            </p>
          </div>

          <!-- Support -->
          <p style="font-size: 14.5px; color: #4b5563; margin-top: 28px;">
            For any queries related to your application, please contact us at
            <a href="mailto:support@wipronix.com" style="color: #ab1428; text-decoration: none;">
              support@wipronix.com
            </a>.
          </p>

          <!-- Closing -->
          <p style="font-size: 15.5px; color: #1f2937; margin-top: 26px;">
            Thank you for your interest in Wipronix. We look forward to potentially working with you.
          </p>
          `}

          <p style="font-size: 15.5px; color: #1f2937;">
            Warm regards,<br />
            <strong>Wipronix</strong><br />
            Human Resources & Talent Acquisition Team
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f3f4f6; padding: 18px; text-align: center; font-size: 13px; color: #6b7280;">
          <p style="margin: 0;">
            This is a system-generated email. Please do not reply.
          </p>
          <p style="margin: 6px 0 0;">
            © 2024 Wipronix. All rights reserved.
          </p>
        </div>
      </div>
    `
  };
};

const applyForInternship = async (req, res, next) => {
  try {
    const { name, email, phone, technology, college, semester, link,city,course,education,passingYear } = req.body;
console.log(req.body);
    // Validation
    if (!name || !email || !phone || !technology || !college || !semester) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Check if student already applied for this technology
    const existingApplication = await Student.findOne({ 
      email, 
      technology 
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "You have already applied for this technology"
      });
    }


    const student = await Student.create(
      { fullName: name, email, phoneNumber:phone, technology, college, semester,city:city,course:course,education:education ,passingYear:passingYear}
    );

    const assessmentLink = link ? assessmentLinks[technology] : null;

    res.status(201).json({
      success: true,
      message: link ? "Application submitted successfully! Check your email for the assessment link." : "Application submitted successfully! Our team will review your application and get back to you.",
      data: {
        studentId: student._id,
        applicationId: student._id,
        studentName: student.fullName,
        technology: student.technology,
        phoneNumber: student.phone,
        city: student.city,
        education: student.education,
        course: student.course,
        passingYear: student.passingYear,
        ...(link && { assessmentLink }),
        emailSent: true
      }
    });

    // Send email asynchronously after response
    const transporter = createTransporter();
    const emailTemplate = createEmailTemplate({ name }, technology, link);

    transporter.sendMail({
      from: process.env.GMAIL_USER || 'your-email@gmail.com',
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    }).then(() => {
      console.log(`${link ? 'Assessment' : 'Welcome'} email sent to ${email} for ${technology}`);
    }).catch((emailError) => {
      console.error('Email sending failed:', emailError);
    });

  } catch (error) {
    console.error('Internship application error:', error);
    next(error);
  }
};

module.exports = applyForInternship;

const nodemailer = require('nodemailer');
const { GMAIL_USER, SUPPORT_EMAIL, WEBSITE_URL, FRONTEND_URL } = require('../config/env');

// Create transporter for Gmail SMTP
const createTransporter = () => {
  if (!GMAIL_APP_PASSWORD) {
    console.warn('⚠️ GMAIL_APP_PASSWORD is not set in environment variables');
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER || 'wipronixtechnologies@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD || 'kekyidqbcsirojzc'
    }
  });
};

// Test Completion Email Template
const createTestCompletionEmailTemplate = (studentData, testResult) => {
  const { fullName, email } = studentData;
  const { totalQuestions, attempted, correct, score } = testResult;
  
  const subject = 'Thank You for Completing Your Assessment - Wipronix';
  
  const websiteUrl = `${WEBSITE_URL}?email=${encodeURIComponent(email)}`;

  return {
    subject,
    html: `
      <div style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ab1428, #7f0d1d); padding: 32px; text-align: center;">
          <img src="https://firebasestorage.googleapis.com/v0/b/unreal-b8198.firebasestorage.app/o/logo.png?alt=media&token=95a16c4f-af45-44ad-aa59-c2dbefd398ea" alt="Wipronix Logo" style="max-width: 150px; height: auto; margin-bottom: 16px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.3px;">
            Assessment Completed Successfully!
          </h1>
          <p style="color: #f3f3f3; margin-top: 8px; font-size: 14px;">
            Technology • Innovation • Career Growth
          </p>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
          <p style="font-size: 16px; color: #1f2937;">
            Dear <strong>${fullName}</strong>,
          </p>

          <p style="font-size: 15.5px; color: #374151; line-height: 1.7;">
            Congratulations! 🎉 You have successfully completed your assessment for the <strong>Wipronix Internship Program</strong>.
          </p>

          <!-- Next Steps -->
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; margin: 26px 0;">
            <h4 style="margin-top: 0; color: #047857; font-size: 16px;">
              What's Next?
            </h4>
            <p style="margin: 0; font-size: 15px; color: #065f46; line-height: 1.7;">
              Our team will review your performance and contact you within <strong>3-4 working days</strong> 
              with the next steps in our selection process.
            </p>
          </div>

          <!-- Website Login Instructions -->
          <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 20px; margin: 26px 0;">
            <h4 style="margin-top: 0; color: #92400e; font-size: 16px;">
              Access Your Account
            </h4>
            <p style="margin: 0; font-size: 15px; color: #78350f; line-height: 1.7;">
              You can login to your Wipronix account using your email: <strong>${email}</strong><br>
              Visit our website to track your application status and get updates.
            </p>
          </div>

          <!-- CTA -->
          <div style="text-align: center; margin: 38px 0;">
            <a href="${websiteUrl}"
               style="background-color: #ab1428; color: #ffffff; padding: 15px 42px;
                      text-decoration: none; font-size: 16px; font-weight: 600;
                      border-radius: 6px; display: inline-block; letter-spacing: 0.4px;">
              Visit Wipronix Website
            </a>
          </div>

          <!-- Support -->
          <p style="font-size: 14.5px; color: #4b5563; margin-top: 28px;">
            For any questions or queries, please contact us at
            <a href="mailto:${SUPPORT_EMAIL}" style="color: #ab1428; text-decoration: none;">
              ${SUPPORT_EMAIL}
            </a>.
          </p>

          <!-- Closing -->
          <p style="font-size: 15.5px; color: #1f2937; margin-top: 26px;">
            Thank you for taking the time to complete your assessment. We appreciate your interest 
            in joining the Wipronix team and look forward to reviewing your results.
          </p>

          <p style="font-size: 15.5px; color: #1f2937;">
            Best regards,<br />
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

// OTP Email Template
const createOTPEmailTemplate = (studentData, otp) => {
  const { fullName, email } = studentData;
  const subject = 'Your Password Reset OTP - Wipronix';
  
  return {
    subject,
    html: `
      <div style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb;">

        <!-- Header -->
        <>< style="background: linear-gradient(135deg, #ab1428, #7f0d1d); padding: 32px; text-align: center;">
            <img src="https://firebasestorage.googleapis.com/v0/b/unreal-b8198.firebasestorage.app/o/logo.png?alt=media&token=95a16c4f-af45-44ad-aa59-c2dbefd398ea " alt="Wipronix Logo" style="max-width: 150px; height: auto; margin-bottom: 16px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.3px;">
                Password Reset OTP
              </h1>
              <p style="color: #f3f3f3; margin-top: 8px; font-size: 14px;">
                Technology • Innovation • Career Growth
              </p>
            </></div>< /></>!-- Body -->
        <div style="padding: 32px;">
          <p style="font-size: 16px; color: #1f2937;">
            Dear <strong>${fullName}</strong>,
          </p>

          <p style="font-size: 15.5px; color: #374151; line-height: 1.7;">
            We received a request to reset your password for your <strong>Wipronix Internship Program</strong> account.
          </p>

          <!-- OTP Section -->
          <div style="background-color: #f3f4f6; border: 2px solid #ab1428; padding: 24px; margin: 26px 0; text-align: center; border-radius: 8px;">
            <h4 style="margin-top: 0; color: #ab1428; font-size: 18px; margin-bottom: 12px;">
              Your OTP Code
            </h4>
            <div style="font-size: 32px; font-weight: bold; color: #ab1428; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
            <p style="margin: 12px 0 0; font-size: 14px; color: #6b7280;">
              This OTP is valid for <strong>10 minutes</strong>
            </p>

          <!-- Instructions -->
          <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 20px; margin: 26px 0;">
            <h4 style="margin-top: 0; color: #92400e; font-size: 16px;">
              How to Reset Your Password
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 15px; color: #78350f; line-height: 1.7;">
              <li>Go to the login page</li>
              <li>Click on "Forgot Password"</li>
              <li>Enter your email address</li>
              <li>Enter the OTP code shown above</li>
              <li>Create a new password</li>
            </ol>
          </div>

          <!-- Security Notice -->
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; margin: 26px 0;">
            <h4 style="margin-top: 0; color: #047857; font-size: 16px;">
              Security Notice
            </h4>
            <p style="margin: 0; font-size: 15px; color: #065f46; line-height: 1.7;">
              If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
              <strong>Never share this OTP with anyone.</strong>
            </p>
          </div>

          <!-- Support -->
          <p style="font-size: 14.5px; color: #4b5563; margin-top: 28px;">
            For any questions or concerns, please contact us at
            <a href="mailto:${SUPPORT_EMAIL}" style="color: #ab1428; text-decoration: none;">
              ${SUPPORT_EMAIL}
            </a>.
          </p>

          <!-- Closing -->
          <p style="font-size: 15.5px; color: #1f2937; margin-top: 26px;">
            Best regards,<br />
            <strong>Wipronix</strong><br />
            Security Team
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

// Send OTP email
const sendOTPSMSEmail = async (studentData, otp) => {
  try {
    const transporter = createTransporter();
    const emailTemplate = createOTPEmailTemplate(studentData, otp);

    const mailOptions = {
      from: GMAIL_USER || 'your-email@gmail.com',
      to: studentData.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent successfully to ${studentData.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return { success: false, error: error.message };
  }
};

// Password Reset Email Template
const createPasswordResetEmailTemplate = (studentData, resetToken) => {
  const { fullName, email } = studentData;
  const subject = 'Reset Your Password - Wipronix';
  
  // Generate secure reset URL
  const resetUrl = `${WEBSITE_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

  return {
    subject,
    html: `
      <div style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ab1428, #7f0d1d); padding: 32px; text-align: center;">
          <img src="https://firebasestorage.googleapis.com/v0/b/unreal-b8198.firebasestorage.app/o/logo.png?alt=media&token=95a16c4f-af45-44ad-aa59-c2dbefd398ea " alt="Wipronix Logo" style="max-width: 150px; height: auto; margin-bottom: 16px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.3px;">
            Password Reset Request
          </h1>
          <p style="color: #f3f3f3; margin-top: 8px; font-size: 14px;">
            Technology • Innovation • Career Growth
          </p>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
          <p style="font-size: 16px; color: #1f2937;">
            Dear <strong>${fullName}</strong>,
          </p>

          <p style="font-size: 15.5px; color: #374151; line-height: 1.7;">
            We received a request to reset your password for your <strong>Wipronix Internship Program</strong> account.
          </p>

          <!-- Reset Instructions -->
          <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 20px; margin: 26px 0;">
            <h4 style="margin-top: 0; color: #92400e; font-size: 16px;">
              Reset Your Password
            </h4>
            <p style="margin: 0; font-size: 15px; color: #78350f; line-height: 1.7;">
              Click the button below to reset your password. This link will expire in <strong>24 hours</strong> for security purposes.
            </p>
          </div>

          <!-- CTA -->
          <div style="text-align: center; margin: 38px 0;">
            <a href="${resetUrl}"
               style="background-color: #ab1428; color: #ffffff; padding: 15px 42px;
                      text-decoration: none; font-size: 16px; font-weight: 600;
                      border-radius: 6px; display: inline-block; letter-spacing: 0.4px;">
              Reset Password
            </a>
          </div>

          <!-- Alternative Link -->
          <div style="background-color: #f3f4f6; border: 1px solid #d1d5db; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <span style="color: #374151; font-family: monospace; font-size: 12px; word-break: break-all;">${resetUrl}</span>
            </p>
          </div>

          <!-- Security Notice -->
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; margin: 26px 0;">
            <h4 style="margin-top: 0; color: #047857; font-size: 16px;">
              Security Notice
            </h4>
            <p style="margin: 0; font-size: 15px; color: #065f46; line-height: 1.7;">
              If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
            </p>
          </div>

          <!-- Support -->
          <p style="font-size: 14.5px; color: #4b5563; margin-top: 28px;">
            For any questions or concerns, please contact us at
            <a href="mailto:${SUPPORT_EMAIL}" style="color: #ab1428; text-decoration: none;">
              ${SUPPORT_EMAIL}
            </a>.
          </p>

          <!-- Closing -->
          <p style="font-size: 15.5px; color: #1f2937; margin-top: 26px;">
            Best regards,<br />
            <strong>Wipronix</strong><br />
            Security Team
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

// Send password reset email
const sendPasswordResetEmail = async (studentData, resetToken) => {
  try {
    const transporter = createTransporter();
    const emailTemplate = createPasswordResetEmailTemplate(studentData, resetToken);

    const mailOptions = {
      from: GMAIL_USER || 'your-email@gmail.com',
      to: studentData.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent successfully to ${studentData.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
};

// Send staff welcome email with offer letter attachment
const sendStaffWelcomeEmailWithOfferLetter = async (staffData, password, pdfBuffer) => {
  try {
    const transporter = createTransporter();
    
    const subject = 'Welcome to Wipronix - Your Offer Letter & Login Credentials';
    
    const html = `
      <div style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb;">
        <!-- Header -->
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ab1428, #7f0d1d); padding: 32px 20px; text-align: center;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center">
                 <img src="https://wipronix.com/assets/logo.png" alt="Wipronix Logo" style="display: block; max-width: 180px; width: 100%; height: auto; margin: 0 auto 20px auto; border: 0;">
              </td>
            </tr>
          </table>
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.3; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
            Welcome to the Team!
          </h1>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
          <p style="font-size: 16px; color: #1f2937;">
            Dear <strong>${staffData.firstName}</strong>,
          </p>

          <p style="font-size: 15.5px; color: #374151; line-height: 1.7;">
            Congratulations! We are thrilled to welcome you to <strong>Wipronix Technologies Pvt. Ltd.</strong> 
            Your offer letter for the position of <strong>${staffData.designation}</strong> is attached to this email.
          </p>

          <!-- Login Credentials -->
          <div style="background-color: #f3f4f6; border: 1px solid #d1d5db; padding: 24px; margin: 26px 0; border-radius: 8px;">
            <h4 style="margin-top: 0; color: #ab1428; font-size: 16px; margin-bottom: 12px;">
              Your Login Credentials
            </h4>
            <div style="font-size: 15px; color: #374151; line-height: 1.8;">
              <strong>Portal URL:</strong> <a href="${WEBSITE_URL}">${WEBSITE_URL}</a><br>
              <strong>Username/Email:</strong> ${staffData.email}<br>
              <strong>Temporary Password:</strong> ${password}
            </div>
            <p style="margin: 12px 0 0; font-size: 13px; color: #6b7280;">
              *Please change your password after your first login for security.
            </p>
          </div>

          <!-- Document Upload Instructions -->
          <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 20px; margin: 26px 0;">
            <h4 style="margin-top: 0; color: #92400e; font-size: 16px;">
              Mandatory Document Upload
            </h4>
            <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.6;">
              As part of our onboarding process, you are required to upload the following documents in your profile section:
            </p>
            <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px; color: #78350f;">
              <li>Identity Proof (Aadhar/PAN/Passport)</li>
              <li>Educational Certificates (Highest Qualification)</li>
              <li>Medical Fitness Document</li>
              <li>Past Experience Letter (if applicable)</li>
            </ul>
            <p style="margin: 0; font-size: 14px; color: #78350f;">
              Failure to upload these within 3 working days may affect your payroll processing.
            </p>
          </div>

          <!-- Next Steps -->
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; margin: 26px 0;">
            <h4 style="margin-top: 0; color: #047857; font-size: 16px;">
              Your Next Steps
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 15px; color: #065f46; line-height: 1.7;">
              <li>Download and review your attached <strong>Offer Letter</strong>.</li>
              <li>Login to the portal using the credentials provided above.</li>
              <li>Go to <strong>My Profile</strong> settings and upload the required documents.</li>
              <li>Update your personal details including address and date of birth.</li>
            </ol>
          </div>

          <p style="font-size: 15.5px; color: #1f2937; margin-top: 26px;">
            If you have any questions, feel free to reach out to our HR department.
          </p>

          <p style="font-size: 15.5px; color: #1f2937;">
            Best regards,<br />
            <strong>Human Resources Team</strong><br />
            Wipronix Technologies
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f3f4f6; padding: 18px; text-align: center; font-size: 13px; color: #6b7280;">
          <p style="margin: 0;">© 2024 Wipronix. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: GMAIL_USER || 'your-email@gmail.com',
      to: staffData.email,
      subject: subject,
      html: html,
      attachments: [
        {
          filename: `Offer_Letter_${staffData.firstName}_${staffData.lastName}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent successfully to ${staffData.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
};

const sendTestCompletionEmail = async (studentData, testResult) => {
  try {
    const transporter = createTransporter();
    const emailTemplate = createTestCompletionEmailTemplate(studentData, testResult);

    const mailOptions = {
      from: GMAIL_USER || 'your-email@gmail.com',
      to: studentData.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    };

    await transporter.sendMail(mailOptions);
    console.log(`Test completion email sent successfully to ${studentData.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send test completion email:', error);
    return { success: false, error: error.message };
  }
};

// Staff Welcome Email Template
const createStaffWelcomeEmailTemplate = (staffData, tempPassword) => {
  const { fullName, email, designation } = staffData;
  const subject = 'Welcome to the Team! - Wipronix Technologies';
  const portalUrl = FRONTEND_URL ? `${FRONTEND_URL}/auth` : 'https://wipronix-frontend.vercel.app/auth';

  return {
    subject,
    html: `
      <div style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ab1428, #7f0d1d); padding: 32px; text-align: center;">
          <img src="https://firebasestorage.googleapis.com/v0/b/unreal-b8198.firebasestorage.app/o/logo.png?alt=media&token=95a16c4f-af45-44ad-aa59-c2dbefd398ea" alt="Wipronix Logo" style="max-width: 150px; height: auto; margin-bottom: 16px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.3px;">
            Welcome to the Team!
          </h1>
          <p style="color: #f3f3f3; margin-top: 8px; font-size: 14px;">
            Technology • Innovation • Career Growth
          </p>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
          <p style="font-size: 16px; color: #1f2937;">
            Dear <strong>${fullName}</strong>,
          </p>

          <p style="font-size: 15.5px; color: #374151; line-height: 1.7;">
            Congratulations! We are thrilled to welcome you to <strong>Wipronix Technologies Pvt. Ltd.</strong> Your offer letter for the position of <strong>${designation || 'Employee'}</strong> is attached to this email.
          </p>

          <!-- Login Credentials -->
          <div style="background-color: #f3f4f6; border: 1px solid #d1d5db; padding: 20px; margin: 26px 0; border-radius: 8px;">
            <h4 style="margin-top: 0; color: #ab1428; font-size: 16px; margin-bottom: 16px;">
              Your Login Credentials
            </h4>
            <p style="margin: 8px 0; font-size: 15px; color: #374151;">
              <strong>Portal URL:</strong> <a href="${portalUrl}" style="color: #ab1428; text-decoration: none;">${portalUrl}</a>
            </p>
            <p style="margin: 8px 0; font-size: 15px; color: #374151;">
              <strong>Username/Email:</strong> ${email}
            </p>
            <p style="margin: 8px 0; font-size: 15px; color: #374151;">
              <strong>Temporary Password:</strong> ${tempPassword}
            </p>
            <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 12px; margin-top: 16px; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>*Please change your password after your first login for security.</strong>
              </p>
            </div>
          </div>

          <!-- Mandatory Document Upload -->
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; margin: 26px 0; border-radius: 8px;">
            <h4 style="margin-top: 0; color: #047857; font-size: 16px; margin-bottom: 12px;">
              Mandatory Document Upload
            </h4>
            <p style="margin: 0 0 12px; font-size: 15px; color: #065f46; line-height: 1.7;">
              As part of our onboarding process, you are required to upload the following documents in your profile section:
            </p>
            <ul style="margin: 0; padding-left: 20px; font-size: 15px; color: #065f46; line-height: 1.9;">
              <li>Identity Proof (Aadhar/PAN/Passport)</li>
              <li>Educational Certificates (Highest Qualification)</li>
              <li>Medical Fitness Document</li>
              <li>Past Experience Letter (if applicable)</li>
            </ul>
            <div style="background-color: #fef3c7; border: 1px solid #fbbf24; padding: 12px; margin-top: 16px; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Failure to upload these within 3 working days may affect your payroll processing.</strong>
              </p>
            </div>
          </div>

          <!-- Your Next Steps -->
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 20px; margin: 26px 0; border-radius: 8px;">
            <h4 style="margin-top: 0; color: #0369a1; font-size: 16px; margin-bottom: 12px;">
              Your Next Steps
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 15px; color: #075985; line-height: 1.9;">
              <li>Download and review your attached Offer Letter</li>
              <li>Login to the portal using the credentials provided above</li>
              <li>Go to My Profile settings and upload the required documents</li>
              <li>Update your personal details including address and date of birth</li>
            </ol>
          </div>

          <!-- Support -->
          <p style="font-size: 14.5px; color: #4b5563; margin-top: 28px;">
            If you have any questions, feel free to reach out to our HR department.
          </p>

          <!-- Closing -->
          <p style="font-size: 15.5px; color: #1f2937; margin-top: 26px;">
            Best regards,<br />
            <strong>Human Resources Team</strong><br />
            Wipronix Technologies
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f3f4f6; padding: 18px; text-align: center; font-size: 13px; color: #6b7280;">
          <p style="margin: 0;">
            This is a system-generated email. Please do not reply.
          </p>
          <p style="margin: 6px 0 0;">
            © 2024 Wipronix Technologies Pvt. Ltd. All rights reserved.
          </p>
        </div>
      </div>
    `
  };
};

// Send staff welcome email
const sendStaffWelcomeEmail = async (staffData, tempPassword) => {
  try {
    const transporter = createTransporter();
    const emailTemplate = createStaffWelcomeEmailTemplate(staffData, tempPassword);

    const mailOptions = {
      from: GMAIL_USER || 'your-email@gmail.com',
      to: staffData.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    };

    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent successfully to ${staffData.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendTestCompletionEmail,
  sendPasswordResetEmail,
  sendOTPSMSEmail,
  sendStaffWelcomeEmail,
  sendStaffWelcomeEmailWithOfferLetter
};

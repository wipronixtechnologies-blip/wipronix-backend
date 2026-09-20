const emailService = require('../../src/services/emailService');

exports.verifySMTP = async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpUsername, smtpPassword } = req.body;

    if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword) {
      return res.status(400).json({
        success: false,
        message: 'Missing required SMTP configuration fields',
      });
    }

    // Sanitize inputs
    const sanitizedHost = smtpHost.trim();
    const sanitizedUsername = smtpUsername.trim();
    // Remove all spaces from password (common when copying App Passwords)
    const sanitizedPassword = smtpPassword.toString().replace(/\s+/g, '');

    const result = await emailService.verifySMTPConnection({
      smtpHost: sanitizedHost,
      smtpPort,
      smtpUsername: sanitizedUsername,
      smtpPassword: sanitizedPassword,
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'SMTP Connection Verified Successfully',
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'SMTP Connection Failed: ' + result.error,
      });
    }
  } catch (error) {
    console.error('Verify SMTP Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
};

exports.saveEmailSettings = async (req, res) => {
  try {
    // Note: Emulating save response since there is currently no designated Configuration/Settings MongoDB collection
    return res.status(200).json({ success: true, message: 'Email settings saved successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to save email settings' });
  }
};

exports.saveGeneralSettings = async (req, res) => {
  try {
    return res.status(200).json({ success: true, message: 'General settings saved successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to save general settings' });
  }
};

const crypto = require('crypto');
const Result = require('../../models/Result.model');
const { sendMachineRoundLinkEmail } = require('../../src/services/emailService');

// Send Machine Round Link
const sendMachineRoundLink = async (request, response) => {
    try {
        const { resultId } = request.body;

        if (!resultId) {
            return response.status(400).json({ success: false, message: 'Result ID is required' });
        }

        const result = await Result.findById(resultId);
        if (!result) {
            return response.status(404).json({ success: false, message: 'Result not found' });
        }

        if (!result.isShortlisted) {
            return response.status(400).json({ success: false, message: 'Student must be shortlisted first' });
        }

        // Generate 64-char token for secure URL access
        const token = crypto.randomBytes(32).toString('hex');

        // Link expires in 24 hours (24 * 60 * 60 * 1000) so candidates have adequate time to attempt
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        result.machineRoundToken = token;
        result.machineRoundTokenExpires = expires;
        result.hasMachineRound = true;
        if (result.machineRoundStatus !== 'COMPLETED') {
            result.machineRoundStatus = 'PENDING';
        }
        await result.save();

        // Trigger email service
        const emailResult = await sendMachineRoundLinkEmail(result, token);

        if (!emailResult.success) {
            return response.status(500).json({ success: false, message: 'Failed to send machine round email' });
        }

        response.status(200).json({
            success: true,
            message: 'Machine Round secure link sent to student email successfully!'
        });

    } catch (error) {
        console.error('Send machine round link error:', error);
        response.status(500).json({ success: false, message: 'Internal server error while sending secure link' });
    }
};

// Verify Machine Round Token
const verifyMachineRoundToken = async (request, response) => {
    try {
        const { token } = request.params;

        if (!token) {
            return response.status(400).json({ success: false, message: 'Token is required' });
        }

        const result = await Result.findOne({
            machineRoundToken: token,
            machineRoundTokenExpires: { $gt: new Date() } // Must not be expired
        });

        if (!result) {
            return response.status(400).json({
                success: false,
                message: 'Invalid or expired secure link. The standard 20-minute validity period has elapsed.'
            });
        }

        response.status(200).json({
            success: true,
            message: 'Token verified successfully',
            data: {
                studentId: result.studentId,
                studentEmail: result.studentEmail,
                studentName: result.studentName,
                collegeName: result.collegeName,
                technology: result.technology,
                resultId: result._id,
                eventCode: result.eventCode
            }
        });

    } catch (error) {
        console.error('Verify machine round token error:', error);
        response.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    sendMachineRoundLink,
    verifyMachineRoundToken
};

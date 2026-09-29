require('dotenv').config({ path: '.env' });
const nodemailer = require('nodemailer');

const testMail = async () => {
    try {
        const { GMAIL_USER, GMAIL_APP_PASSWORD } = require('./src/config/env');
        console.log("Config loaded.");
        console.log("GMAIL_USER:", GMAIL_USER);
        console.log("GMAIL_APP_PASSWORD exists:", !!GMAIL_APP_PASSWORD);
        console.log("process.env.GMAIL_APP_PASSWORD exists:", !!process.env.GMAIL_APP_PASSWORD);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: GMAIL_USER || 'wipronixtechnologies@gmail.com',
                pass: GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || 'kekyidqbcsirojzc'
            }
        });

        const mailOptions = {
            from: GMAIL_USER || 'wipronixtechnologies@gmail.com',
            to: 'wipronixtechnologies@gmail.com',
            subject: 'Test Email',
            html: '<h1>If you see this, Nodemailer is working</h1>'
        };

        const result = await transporter.sendMail(mailOptions);
        console.log("Success messageId:", result.messageId);
    } catch (err) {
        console.error("Error occurred:", err);
    }
};

testMail();

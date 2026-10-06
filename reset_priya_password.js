const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Staff = require('./models/Staff.model');
// Assuming script is in wipronix-backend directory

async function resetPassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wipronix');
        console.log("Connected to MongoDB.");

        const salt = await bcrypt.genSalt(10);
        const newHashedPassword = await bcrypt.hash("123456", salt);

        const result = await Staff.updateOne(
            { email: "priya@gmail.com" },
            { $set: { password: newHashedPassword } }
        );

        console.log("Update Result:", result);
        console.log("Her password has been reset to: 123456");

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

resetPassword();

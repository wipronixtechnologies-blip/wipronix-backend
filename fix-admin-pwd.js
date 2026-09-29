const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env' });
const { MONGODB_URI } = require('./src/config/env');
const Staff = require('./models/Staff.model');

const fixPwd = async () => {
    try {
        await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to MongoDB.");

        const adminEmail = 'wipronixtechnologies@gmail.com';
        const staff = await Staff.findOne({ email: adminEmail });

        if (staff) {
            staff.password = 'Wipronix@123';
            await staff.save();
            console.log(`Successfully reset password for ${adminEmail} to Wipronix@123`);
        } else {
            console.log("Admin account not found");
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
};

fixPwd();

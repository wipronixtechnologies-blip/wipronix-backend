require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('./models/Staff.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://amrit0207232_db_user:pWVImE58Y5Ed2RKt@wipronix.grx0gfo.mongodb.net/';

async function restrictSuperAdmins() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const whitelist = 'wipronixtechnologies@gmail.com';

    // Find all staff who are super_admins but not the whitelisted email
    const others = await Staff.find({
      email: { $ne: whitelist },
      $or: [
        { role: 'super_admin' },
        { systemRole: 'super_admin' }
      ]
    });

    console.log(`Found ${others.length} staff members with unauthorized super_admin access.`);

    for (const s of others) {
      console.log(`Demoting ${s.fullName} (${s.email})...`);
      s.role = 'admin';
      s.systemRole = 'admin';
      await s.save();
    }

    console.log('✅ Restoration complete. Only wipronixtechnologies@gmail.com is now a super_admin.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error restricting super admins:', error);
    process.exit(1);
  }
}

restrictSuperAdmins();

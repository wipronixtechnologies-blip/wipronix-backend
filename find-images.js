require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('./models/Staff.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://amrit0207232_db_user:pWVImE58Y5Ed2RKt@wipronix.grx0gfo.mongodb.net/';

async function findImages() {
  try {
    await mongoose.connect(MONGO_URI);
    const staffWithImages = await Staff.find({ profileImage: { $exists: true, $ne: '' } });
    console.log(`Found ${staffWithImages.length} staff with images.`);
    staffWithImages.forEach(s => {
      console.log(`${s.email}: ${s.profileImage}`);
    });
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

findImages();

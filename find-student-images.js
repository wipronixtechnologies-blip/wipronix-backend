require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://amrit0207232_db_user:pWVImE58Y5Ed2RKt@wipronix.grx0gfo.mongodb.net/';

async function findImages() {
  try {
    await mongoose.connect(MONGO_URI);
    const studentsWithImages = await Student.find({ profilePicture: { $exists: true, $ne: '' } });
    console.log(`Found ${studentsWithImages.length} students with images.`);
    studentsWithImages.forEach(s => {
      console.log(`${s.email}: ${s.profilePicture}`);
    });
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

findImages();

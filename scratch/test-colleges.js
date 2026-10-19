const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const College = require('../models/College.model');
const EventTest = require('../models/EventTest.model');
const Student = require('../models/Student.model');
const Result = require('../models/Result.model');

async function test() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wipronix';
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const [colleges, events, students, results] = await Promise.all([
    College.find().distinct('name'),
    EventTest.find().distinct('collegeName'),
    Student.find().distinct('college'),
    Result.find().distinct('collegeName')
  ]);

  console.log('Colleges from College model:', colleges);
  console.log('Colleges from EventTest model:', events);
  console.log('Colleges from Student model:', students);
  console.log('Colleges from Result model:', results);

  const set = new Set();
  [...colleges, ...events, ...students, ...results].forEach(n => {
    if (n && typeof n === 'string' && n.trim()) set.add(n.trim());
  });

  console.log('All merged unique colleges (count ' + set.size + '):', Array.from(set).sort());
  await mongoose.disconnect();
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});

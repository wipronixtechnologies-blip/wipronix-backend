const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wipronix');
  const db = mongoose.connection.db;

  const emails = ['sikandersingh73@gmail.com', 'rajwinderkaur0@gmail.com'];

  console.log('=== CHECKING TEST SESSIONS ===');
  const testSessions = await db.collection('testsessions').find({
    email: { $in: emails }
  }).toArray();
  console.log('TestSessions found:', testSessions.length);
  testSessions.forEach(ts => {
    console.log({
      _id: ts._id,
      email: ts.email,
      status: ts.status,
      completedAt: ts.completedAt,
      isCompleted: ts.isCompleted,
      createdAt: ts.createdAt
    });
  });

  console.log('\n=== CHECKING RESULTS COLLECTION FOR ANY OTHER RECORDS WITH THESE NAMES OR EMAILS ===');
  const results = await db.collection('results').find({
    $or: [
      { studentEmail: { $in: emails } },
      { studentName: { $regex: /sikander|rajwinder/i } }
    ]
  }).toArray();
  console.log('Results found:', results.length);
  results.forEach(r => {
    console.log({
      _id: r._id,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      collegeName: r.collegeName,
      hasMachineRound: r.hasMachineRound,
      machineRoundStatus: r.machineRoundStatus,
      machineRoundScore: r.machineRoundScore,
      machineRoundSubmittedAt: r.machineRoundSubmittedAt,
      machineRoundToken: r.machineRoundToken ? r.machineRoundToken.slice(0, 10) + '...' : null,
      machineRoundTokenExpires: r.machineRoundTokenExpires,
      percentage: r.percentage
    });
  });

  console.log('\n=== CHECKING ALL RESULTS IN Sri Guru Granth Sahib World University ===');
  const collegeResults = await db.collection('results').find({
    collegeName: { $regex: /Sri Guru Granth Sahib/i },
    isShortlisted: true
  }).toArray();
  console.log('Shortlisted candidates in this college:', collegeResults.length);
  collegeResults.forEach(cr => {
    console.log({
      name: cr.studentName,
      email: cr.studentEmail,
      machineRoundStatus: cr.machineRoundStatus,
      score: cr.machineRoundScore,
      submittedAt: cr.machineRoundSubmittedAt,
      hasCode: Boolean(cr.machineRoundCode),
      tokenExpires: cr.machineRoundTokenExpires
    });
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

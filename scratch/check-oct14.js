const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wipronix');
  const db = mongoose.connection.db;

  const results = await db.collection('results').find({
    updatedAt: {
      $gte: new Date('2026-10-14T06:00:00.000Z'),
      $lte: new Date('2026-10-14T14:00:00.000Z')
    }
  }).sort({ updatedAt: -1 }).toArray();

  console.log('Results updated on Oct 14 during placement drive:', results.length);
  results.forEach(r => {
    console.log({
      name: r.studentName,
      email: r.studentEmail,
      college: r.collegeName,
      status: r.machineRoundStatus,
      score: r.machineRoundScore,
      submittedAt: r.machineRoundSubmittedAt,
      hasCode: Boolean(r.machineRoundCode),
      token: r.machineRoundToken ? r.machineRoundToken.slice(0, 8) : null,
      updatedAt: r.updatedAt
    });
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

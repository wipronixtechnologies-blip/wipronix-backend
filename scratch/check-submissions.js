const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wipronix');
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const targetEmail = 'sikandersingh73@gmail.com';
  for (const col of collections) {
    const c = mongoose.connection.db.collection(col.name);
    const docs = await c.find({
      $or: [
        { email: new RegExp(targetEmail, 'i') },
        { studentEmail: new RegExp(targetEmail, 'i') },
        { 'session.email': new RegExp(targetEmail, 'i') }
      ]
    }).toArray();

    if (docs.length > 0) {
      console.log(`\nFound ${docs.length} document(s) in collection [${col.name}]:`);
      docs.forEach(d => {
        console.log(JSON.stringify(d, null, 2));
      });
    }
  }

  // Also check rajwinder
  const targetEmail2 = 'rajwinderkaur0@gmail.com';
  for (const col of collections) {
    const c = mongoose.connection.db.collection(col.name);
    const docs = await c.find({
      $or: [
        { email: new RegExp(targetEmail2, 'i') },
        { studentEmail: new RegExp(targetEmail2, 'i') },
        { 'session.email': new RegExp(targetEmail2, 'i') }
      ]
    }).toArray();

    if (docs.length > 0) {
      console.log(`\nFound ${docs.length} document(s) for rajwinder in [${col.name}]:`);
      docs.forEach(d => {
        console.log(JSON.stringify(d, null, 2));
      });
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

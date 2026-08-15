const admin = require('firebase-admin');
require('dotenv').config();

const { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } = process.env;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: FIREBASE_CLIENT_EMAIL,
  }),
});

async function testBucket() {
  const storage = admin.storage();
  const buckets = [
    `${FIREBASE_PROJECT_ID}.appspot.com`,
    `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
    `wipronix-tech.appspot.com`,
    `internship-1b6cd.appspot.com`
  ];

  for (const b of buckets) {
    console.log(`Testing bucket: ${b}`);
    try {
      const bucket = storage.bucket(b);
      const [exists] = await bucket.exists();
      console.log(`Exists: ${exists}`);
      if (exists) {
        console.log(`>>> SUCCESS! FOUND BUCKET: ${b}`);
        break;
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
  process.exit(0);
}

testBucket();

require('dotenv').config();
const admin = require('firebase-admin');

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;

if (!admin.apps.length) {
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: FIREBASE_CLIENT_EMAIL,
  }),
});
}

const bucketsToTest = [
  'wipronix.appspot.com',
  'internship-1b6cd.appspot.com',
  'wipronix-tech.appspot.com',
  'carrierlife.appspot.com'
];

async function check() {
  for (const b of bucketsToTest) {
    console.log(`Testing bucket: ${b}`);
    try {
      const bucket = admin.storage().bucket(b);
      const [exists] = await bucket.exists();
      console.log(`Exists: ${exists}`);
      if (exists) {
        console.log(`>>> FOUND IT! Correct bucket is: ${b}`);
        break;
      }
    } catch (err) {
      console.log(`Error testing ${b}:`, err.message);
    }
  }
  process.exit(0);
}

check();

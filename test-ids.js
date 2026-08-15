const admin = require('firebase-admin');
require('dotenv').config();

const { FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } = process.env;

async function test(projectId) {
  console.log(`Testing Project ID: ${projectId}`);
  if (admin.apps.length) await admin.app().delete();
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: projectId,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: FIREBASE_CLIENT_EMAIL,
    }),
    storageBucket: `${projectId}.appspot.com`
  });

  const bucket = admin.storage().bucket();
  console.log(`Initialized with bucket: ${bucket.name}`);
  try {
    const [exists] = await bucket.exists();
    console.log(`Exists: ${exists}`);
    return exists;
  } catch (err) {
    console.log(`Error: ${err.message}`);
    return false;
  }
}

async function run() {
  const ids = ['wipronix', 'internship-1b6cd', 'wipronix-tech', 'carrierlife'];
  for (const id of ids) {
    const ok = await test(id);
    if (ok) {
      console.log(`>>> SUCCESS! Correct Project ID is: ${id}`);
      break;
    }
  }
  process.exit(0);
}

run();

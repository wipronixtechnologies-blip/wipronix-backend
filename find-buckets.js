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

async function findBuckets() {
  try {
    const storage = admin.storage();
    console.log('Fetching all buckets for project...');
    const [buckets] = await storage.getBuckets();
    
    if (buckets.length === 0) {
      console.log('No buckets found in this project.');
    } else {
      console.log('Found buckets:');
      buckets.forEach(b => console.log(' -', b.name));
    }
    process.exit(0);
  } catch (error) {
    console.error('Failed to find buckets:', error.message);
    process.exit(1);
  }
}

findBuckets();

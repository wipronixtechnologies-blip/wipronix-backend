const admin = require('firebase-admin');
require('dotenv').config();

const { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } = process.env;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: FIREBASE_CLIENT_EMAIL,
  })
});

async function run() {
  try {
    const buckets = await admin.storage().bucket().getFiles();
    console.log('Successfully accessed default bucket files');
    process.exit(0);
  } catch (err) {
    console.error('Bucket access error:', err.message);
    
    try {
      console.log('Attempting to list buckets via storage object...');
      // In some versions of firebase-admin, you need to use the @google-cloud/storage library directly or through the admin object
      const [allBuckets] = await admin.storage().storage.getBuckets();
      console.log('Available buckets:');
      allBuckets.forEach(b => console.log(' - ' + b.name));
    } catch (err2) {
      console.error('Could not list buckets:', err2.message);
    }
    process.exit(1);
  }
}

run();

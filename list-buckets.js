const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

const { FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } = process.env;

const projects = ['wipronix', 'internship-1b6cd', 'wipronix-tech'];

async function listBuckets() {
  for (const p of projects) {
    console.log(`Listing buckets for project: ${p}`);
    const storage = new Storage({
      projectId: p,
      credentials: {
        client_email: FIREBASE_CLIENT_EMAIL,
        private_key: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    });

    try {
      const [buckets] = await storage.getBuckets();
      console.log(`Found ${buckets.length} buckets in ${p}.`);
      buckets.forEach(bucket => {
        console.log(` - ${bucket.name}`);
      });
      if (buckets.length > 0) break;
    } catch (err) {
      console.error(`Error in ${p}:`, err.message);
    }
  }
}

listBuckets();

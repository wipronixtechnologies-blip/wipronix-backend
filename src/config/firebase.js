const admin = require('firebase-admin');
const { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_STORAGE_BUCKET } = require('./env');

// Check if Firebase credentials are provided
const hasFirebaseCredentials = FIREBASE_PROJECT_ID && FIREBASE_PRIVATE_KEY && FIREBASE_CLIENT_EMAIL;

// Only initialize Firebase Admin SDK if credentials are provided
let bucket = null;
if (hasFirebaseCredentials) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          privateKey: FIREBASE_PRIVATE_KEY ? FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
          clientEmail: FIREBASE_CLIENT_EMAIL,
        }),
        storageBucket: FIREBASE_STORAGE_BUCKET
      });
    }
    // Get Firebase Storage instance
    bucket = admin.storage().bucket();
    console.log("✅ Firebase initialized successfully");
  } catch (error) {
    console.warn("⚠️ Firebase initialization failed:", error.message);
  }
} else {
  console.warn("⚠️ Firebase credentials not found, Firebase services will be disabled");
}

// Export Firebase admin and storage bucket
module.exports = {
  admin,
  bucket
};


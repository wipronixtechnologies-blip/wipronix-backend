# Firebase Storage Setup for Backend

## Overview
This document describes how to set up Firebase Storage for storing user images and files in the backend.

## Prerequisites

### 1. Firebase Project Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable Cloud Storage:
   - Go to "Build" > "Storage"
   - Click "Get Started"
   - Set security rules (see below)

### 2. Service Account Setup
1. Go to Project Settings > Service Accounts
2. Click "Generate new private key"
3. Save the JSON file securely
4. Extract the following values for environment variables:
   - `FIREBASE_PROJECT_ID`: From `project_id` field
   - `FIREBASE_CLIENT_EMAIL`: From `client_email` field
   - `FIREBASE_PRIVATE_KEY`: From `private_key` field (handle newlines properly)

### 3. Storage Bucket Setup
1. Go to Project Settings > General
2. Copy the "Default GCP resource location" for storage
3. Storage bucket URL format: `<project-id>.appspot.com`

## Environment Variables

Add these to your `.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

**Important**: For `FIREBASE_PRIVATE_KEY`, replace actual newlines with `\n` in the .env file, or the code will handle the replacement.

## Firebase Security Rules

### Storage Rules (firestore.rules or storage.rules)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Public read access for uploaded images
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null 
                   && request.resource.size < 5 * 1024 * 1024 // 5MB max
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### Firestore Rules (if using Firestore)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles
    match /students/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## CORS Configuration

Create a `storage-cors.json` file:

```json
[
  {
    "origin": ["http://localhost:5173", "https://your-domain.com"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization"]
  }
]
```

Apply CORS configuration:
```bash
gsutil cors set storage-cors.json gs://your-project.appspot.com
```

## Usage Examples

### Upload Image
```javascript
const imageService = require('./services/imageService');

const uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const result = await imageService.uploadImage(
    req.file, 
    'profile-pictures' // or 'images'
  );

  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({ error: result.error });
  }
};
```

### Delete Image
```javascript
const imageService = require('./services/imageService');

const deleteImage = async (filePath) => {
  const result = await imageService.deleteImage(filePath);
  return result;
};
```

### Get Signed URL
```javascript
const imageService = require('./services/imageService');

const getAccessUrl = async (filePath) => {
  const result = await imageService.getSignedUrl(filePath, 3600000); // 1 hour
  return result.data.url;
};
```

## File Structure

```
backend/
├── src/
│   ├── config/
│   │   └── firebase.js          # Firebase Admin SDK setup
│   ├── services/
│   │   └── imageService.js      # Firebase Storage operations
│   └── controllers/
│       └── Image/
│           └── uploadImage.js   # Upload endpoint
├── .env                          # Environment variables
└── package.json                  # Dependencies
```

## Testing Locally

1. Set up Firebase emulators (optional):
   ```bash
   firebase init emulators
   ```

2. Update firebase.js to use emulators for local testing

3. Run locally:
   ```bash
   npm run dev
   ```

## Deployment

### Vercel
1. Add environment variables in Vercel dashboard
2. Ensure Firebase Admin SDK is properly initialized
3. Test file upload/delete operations

### Production Considerations
1. Set up lifecycle rules for storage
2. Monitor usage and costs
3. Set up alerts for unusual activity
4. Implement proper error handling
5. Add rate limiting for uploads

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Check service account permissions
   - Verify storage bucket rules
   - Ensure auth is passed in requests

2. **File Too Large**
   - Check max file size (5MB)
   - Implement client-side validation

3. **CORS Errors**
   - Configure CORS for your domain
   - Check browser console for details

4. **Invalid Private Key**
   - Ensure newlines are properly handled
   - Verify key format in .env


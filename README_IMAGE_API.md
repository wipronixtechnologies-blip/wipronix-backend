# Firebase Image Upload API Documentation

## Overview
This API provides endpoints for uploading, deleting, and retrieving metadata of images stored in Firebase Storage.

## Base URL
```
http://localhost:PORT/api/image
```

## Environment Variables Required
Add these to your `.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

## Endpoints

### 1. Upload Image
Upload a single image to Firebase Storage.

**Endpoint:** `POST /api/image/upload`

**Content-Type:** `multipart/form-data`

**Request Body:**
- `image` (file, required): Image file to upload
- `folder` (string, optional): Folder path in storage (default: 'images')

**Response:**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "fileName": "uuid-timestamp.jpg",
    "filePath": "images/uuid-timestamp.jpg",
    "publicUrl": "https://storage.googleapis.com/bucket-name/images/uuid-timestamp.jpg",
    "size": 1024000,
    "contentType": "image/jpeg",
    "originalName": "my-image.jpg",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "gsUri": "gs://bucket-name/images/uuid-timestamp.jpg"
  }
}
```

### 2. Delete Image
Delete an image from Firebase Storage.

**Endpoint:** `DELETE /api/image/:filePath`

**URL Parameters:**
- `filePath` (string, required): Path of the file to delete (e.g., "images/uuid-timestamp.jpg")

**Response:**
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

### 3. Get Image Metadata
Retrieve metadata of an uploaded image.

**Endpoint:** `GET /api/image/:filePath/metadata`

**URL Parameters:**
- `filePath` (string, required): Path of the file (e.g., "images/uuid-timestamp.jpg")

**Response:**
```json
{
  "success": true,
  "message": "Image metadata retrieved successfully",
  "data": {
    "name": "images/uuid-timestamp.jpg",
    "size": "1024000",
    "contentType": "image/jpeg",
    "created": "2024-01-15T10:30:00.000Z",
    "updated": "2024-01-15T10:30:00.000Z",
    "md5Hash": "abc123..."
  }
}
```

## Validation Rules

### File Upload
- **Allowed formats:** JPEG, JPG, PNG, GIF, WebP
- **Maximum file size:** 5MB
- **Field name:** `image`

### Error Responses
All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

## Usage Examples

### JavaScript/Node.js
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('folder', 'profile-pictures');

fetch('/api/image/upload', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

### cURL
```bash
# Upload image
curl -X POST -F "image=@/path/to/image.jpg" -F "folder=my-images" \
  http://localhost:3000/api/image/upload

# Delete image
curl -X DELETE http://localhost:3000/api/image/images/uuid-timestamp.jpg

# Get metadata
curl http://localhost:3000/api/image/images/uuid-timestamp.jpg/metadata
```

## Firebase Setup Instructions

1. **Create Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project

2. **Enable Storage:**
   - In Firebase Console, go to Storage
   - Click "Get started"
   - Follow the setup wizard

3. **Create Service Account:**
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Download the JSON file

4. **Configure Storage Rules (Optional):**
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /images/{allPaths=**} {
         allow read, write: if true; // Adjust based on your security needs
       }
     }
   }
   ```

## Security Considerations

- Files are made public by default for easy access
- Consider implementing authentication for production use
- Review and customize Firebase Storage security rules
- Monitor file upload sizes and frequency
- Validate file types on both client and server side

## Rate Limiting
- Default: 120 requests per minute per IP
- Configurable in `src/app.js`


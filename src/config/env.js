module.exports = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_DEVELOPMENT: process.env.NODE_ENV !== 'production',
    
    // MongoDB Configuration
    MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI,
    
    // Redis Configuration
    REDIS_URL: process.env.REDIS_URL,
    
    // JWT Configuration
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    
    // Firebase Configuration
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    
    // Email Configuration
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@wipronix.com',
    WEBSITE_URL: process.env.WEBSITE_URL || 'http://localhost:5173/onBoard',
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://wipronix-frontend.vercel.app'
  };
  
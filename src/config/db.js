const mongoose = require("mongoose");

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1';

// Support both MONGODB_URI and MONGO_URI environment variables
const getMongoUri = () => {
  return process.env.MONGODB_URI || process.env.MONGO_URI;
};

const connectDB = async () => {
  const mongoUri = getMongoUri();
  
  if (!mongoUri) {
    throw new Error("MongoDB URI not found. Please set MONGODB_URI or MONGO_URI environment variable.");
  }

  try {
    mongoose.set("strictQuery", true);

    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log("✅ MongoDB already connected");
      return;
    }

    // Connection options optimized for Vercel serverless
    const options = {
      maxPoolSize: isVercel ? 1 : 10,
      serverSelectionTimeoutMS: isVercel ? 30000 : 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
    };

    await mongoose.connect(mongoUri, options);

    console.log("✅ MongoDB connected successfully");
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    // Don't exit on Vercel - allow the function to handle the error
    if (!isVercel) {
      process.exit(1);
    }
    throw error; // Re-throw for Vercel to handle
  }
};

module.exports = connectDB;


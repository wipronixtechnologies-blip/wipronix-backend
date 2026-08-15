const mongoose = require("mongoose");

const isVercel = process.env.VERCEL === '1';

const getMongoUri = () => {
  return process.env.MONGODB_URI || process.env.MONGO_URI;
};

const connectDB = async () => {
  const primaryUri = getMongoUri();
  
  if (!primaryUri) {
    console.warn("⚠️ MongoDB URI not found in environment variables.");
  }

  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);

  if (mongoose.connection.readyState === 1) {
    console.log("✅ MongoDB already connected");
    return;
  }

  const options = {
    maxPoolSize: isVercel ? 1 : 10,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
    retryWrites: true,
  };

  // Try primary URI first
  if (primaryUri) {
    try {
      console.log("Attempting MongoDB Atlas connection...");
      await mongoose.connect(primaryUri, options);
      console.log("✅ MongoDB connected successfully to Primary Atlas DB");
      return;
    } catch (primaryErr) {
      console.warn("⚠️ Primary MongoDB Atlas connection failed:", primaryErr.message);
      console.warn("Checking for local MongoDB fallback...");
    }
  }

  // Fallback to local MongoDB if primary fails
  try {
    const localUri = "mongodb://127.0.0.1:27017/wipronix";
    await mongoose.connect(localUri, { ...options, serverSelectionTimeoutMS: 3000 });
    console.log("✅ MongoDB connected successfully to Local Database");
  } catch (localErr) {
    console.error("❌ MongoDB connection failed for both Atlas and Local DB:", localErr.message);
    console.warn("⚠️ Please check MongoDB Atlas IP Whitelist (0.0.0.0/0) in MongoDB Atlas Security Settings.");
  }
};

module.exports = connectDB;

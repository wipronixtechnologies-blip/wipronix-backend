const app = require("../src/app");
const connectDB = require("../src/config/db");
const redis = require("../src/config/redis");

// Allowed origins for CORS (commented out to allow all origins)
// const allowedOrigins = [
//   "https://www.wipronix.com",
//   "https://www.wipronix.com/",
//   "https://wipronix.com/",
//   "https://internship-1b6cd.web.app",
//   "https://wipronix-frontend.vercel.app",
//   "http://localhost:5173",
//   "http://localhost:3000"
// ];

// CORS handling function for serverless environment - allow all origins
const handleCors = (req, res, next) => {
  const origin = req.headers.origin;

  // Previous restricted origin validation (commented out):
  // const isAllowedOrigin = !origin || allowedOrigins.includes(origin);
  // const allowedOrigin = isAllowedOrigin ? (origin || allowedOrigins[0]) : allowedOrigins[0];
  // res.setHeader("Access-Control-Allow-Origin", allowedOrigin);

  // Allow all origins (*)
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Student-Id, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
};

// Store connection promises to avoid multiple connections
let dbConnectionPromise = null;
let redisConnectionPromise = null;

const initDatabase = async () => {
  if (dbConnectionPromise) {
    return dbConnectionPromise;
  }

  dbConnectionPromise = (async () => {
    try {
      await connectDB();
      return true;
    } catch (error) {
      console.error("Database connection error:", error.message);
      dbConnectionPromise = null;
      throw error;
    }
  })();

  return dbConnectionPromise;
};

const initRedis = async () => {
  if (redisConnectionPromise) {
    return redisConnectionPromise;
  }

  redisConnectionPromise = (async () => {
    try {
      // With lazyConnect: true, Redis will auto-connect on first operation
      return true;
    } catch (error) {
      console.error("Redis connection error:", error.message);
      redisConnectionPromise = null;
      throw error;
    }
  })();

  return redisConnectionPromise;
};

// Vercel serverless function handler
// Initialize database and Redis before handling requests
module.exports = async (req, res) => {
  try {
    // Apply CORS headers first for all requests (including preflight)
    handleCors(req, res, async () => {
      try {
        // Initialize database and Redis connections in parallel
        await Promise.all([
          initDatabase(),
          initRedis()
        ]);
        
        // Handle the request with Express app
        return app(req, res);
      } catch (error) {
        console.error("Request handling error:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error",
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });
  } catch (error) {
    console.error("CORS handling error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

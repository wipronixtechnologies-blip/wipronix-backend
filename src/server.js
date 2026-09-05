const app = require("./app");
const http = require("http");
const connectDB = require("./config/db");
const redis = require("./config/redis");
const { connectRedis } = require("./config/redis");
const { initSocketServer } = require("./services/socket");

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Ensure Machine Round default configs and challenges are seeded
    try {
      const { ensureSeed } = require("../controllers/Test/machineRoundController");
      if (typeof ensureSeed === "function") {
        await ensureSeed();
      }
    } catch (sErr) {
      console.warn("Machine seed on start warning:", sErr.message);
    }
    
    // Connect to Redis
    const redisConnected = await connectRedis();
    if (!redisConnected) {
      console.warn("⚠️ Redis connection failed, but continuing with server startup...");
    }

    const PORT = process.env.PORT || 5000;

    // Create HTTP server from Express app
    const server = http.createServer(app);

    // Initialize Socket.IO
    initSocketServer(server);

    // Start listening
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.IO ready for connections`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

module.exports = startServer;

require("dotenv").config();

const app = require('./src/app');
const http = require('http');
const connectDB = require('./src/config/db');
const redis = require('./src/config/redis');
const { connectRedis } = require('./src/config/redis');
const { initSocketServer } = require('./src/services/socket');

async function test() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB connected');
    
    console.log('🔄 Connecting to Redis...');
    const redisConnected = await connectRedis();
    if (!redisConnected) {
      console.warn('⚠️ Redis connection failed, continuing...');
    } else {
      console.log('✅ Redis connected successfully');
    }
    
    const PORT = process.env.PORT || 5001;
    const server = http.createServer(app);
    initSocketServer(server);
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.IO ready for connections`);
      
      // Keep server running for a moment then close
      setTimeout(() => {
        console.log('🧪 Test completed successfully!');
        server.close();
        process.exit(0);
      }, 3000);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();


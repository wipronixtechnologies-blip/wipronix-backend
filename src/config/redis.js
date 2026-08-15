const Redis = require("ioredis");

// Detect if using local Redis (localhost) or cloud Redis (Upstash)
const isLocalRedis = process.env.USE_LOCAL_REDIS === 'true';

// Support both REDIS_URL with embedded password and separate REDIS_TOKEN
const getRedisUrl = () => {
  // If using local Redis, default to localhost
  if (isLocalRedis) {
    return process.env.LOCAL_REDIS_URL || 'redis://localhost:6379';
  }
  
  const url = process.env.REDIS_URL;
  const token = process.env.REDIS_TOKEN;
  
  if (url && url.includes(':') && !url.includes('@')) {
    // URL without password, add token if provided
    if (token) {
      const [protocol, rest] = url.split('://');
      const [host, ...restParts] = rest.split(':');
      const port = restParts.join(':');
      return `${protocol}://:${token}@${host}:${port}`;
    }
  }
  
  // If URL already has auth or no token provided, use as-is
  return url;
};

const redisConfig = {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  connectTimeout: 10000,
  
};

// For local Redis, no need for special TLS
const redisUrl = getRedisUrl();
const redis = new Redis(redisUrl, redisConfig);

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
});

redis.on("ready", () => {
  console.log("✅ Redis ready");
});

// Function to connect and verify Redis connection
const connectRedis = async () => {
  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }
    // Test connection
    await redis.ping();
    console.log("✅ Redis connection verified");
    return true;
  } catch (error) {
    console.error("❌ Redis connection failed:", error.message);
    return false;
  }
};

module.exports = redis;
module.exports.connectRedis = connectRedis;

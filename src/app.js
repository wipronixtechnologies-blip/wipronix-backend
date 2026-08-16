const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");
const routes =require('./routes/index')
const healthRoute = require("./routes/health.route");
const errorHandler = require("./middlewares/errorHandler");
const notFound = require("./middlewares/notFound");
const env = require("./config/env");

const app = express();

// =============================================================================
// RENDER PROXY CONFIGURATION
// =============================================================================
// Render uses a proxy/load balancer in front of your server.
// This setting tells Express to trust the first proxy hop (Render's load balancer).
// This is REQUIRED for correct client IP detection with X-Forwarded-For header.
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: "90mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Firebase Storage URLs are returned directly from the API
// No need for static file serving since files are in Firebase Cloud Storage

// =============================================================================
// CORS CONFIGURATION
// =============================================================================
// Allowed origins - add your frontend URLs here
const allowedOrigins = [
  "https://internship-1b6cd.web.app",
  "https://wipronix-website.web.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8080",
  "http://localhost:5173"
];

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development mode, allow all origins (remove this in production for security)
    if (env.IS_DEVELOPMENT) {
      console.log(`[CORS DEBUG] Development mode - allowing origin: "${origin}"`);
      return callback(null, true);
    }
    
    // Block origin in production if not in allowed list
    console.log(`[CORS ERROR] Blocked origin: "${origin}"`);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["set-cookie"],

};

// Apply CORS middleware
app.use(cors(corsOptions));

// Logging
app.use(morgan("dev"));

// =============================================================================
// RATE LIMITING CONFIGURATION
// =============================================================================
// Custom keyGenerator for Render's proxy environment.
// Render sets X-Forwarded-For header with client IP, but we need to:
// 1. Extract the first IP from the comma-separated list
// 2. Use ipKeyGenerator helper for proper IPv6 normalization
const keyGenerator = (req) => {
  // Get X-Forwarded-For header (format: "client, proxy1, proxy2, ...")
  const forwardedFor = req.headers['x-forwarded-for'];

  if (forwardedFor) {
    // Extract the first IP (client's actual IP), trim whitespace
    const clientIP = forwardedFor.split(',')[0].trim();

    // Validate it's a non-empty string
    if (clientIP && clientIP.length > 0) {
      return clientIP;
    }
  }

  // Use the library's ipKeyGenerator for proper IPv6 handling
  // This ensures consistent IP normalization and prevents bypass
  return ipKeyGenerator(req);
};

// Rate limiting - exclude OPTIONS requests
// Increased max to 5000 to allow campus drives where 1000+ students share the same public IP (NAT)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5000,
  skip: (req) => req.method === 'OPTIONS',
  keyGenerator: keyGenerator
});
app.use(limiter);

// Routes
app.use(routes);
app.use("/", healthRoute);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;

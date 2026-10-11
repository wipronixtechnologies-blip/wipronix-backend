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
// CORS CONFIGURATION (Secured with Domain Whitelisting)
// =============================================================================
// Build list of allowed origins from environment and known trusted domains

  // "https://internship-1b6cd.web.app",
  // "https://wipronix-website.web.app",
  // "https://wipronix-frontend.vercel.app",
  // "http://localhost:3000",
  // "http://localhost:3001",
  // "http://127.0.0.1:3000",
  // "https://admin.wipronix.com",


  
const trustedOrigins = [
  "https://wipronix.com",
  "https://www.wipronix.com",
  "https://wipronix-admin-pannel.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080"
];

// Add environment URLs if set
if (process.env.CLIENT_URL) trustedOrigins.push(process.env.CLIENT_URL.trim().replace(/\/+$/, ''));
if (process.env.WEBSITE_URL) {
  try {
    const origin = new URL(process.env.WEBSITE_URL).origin;
    trustedOrigins.push(origin);
  } catch (e) { }
}
if (process.env.FRONTEND_URL) {
  try {
    const origin = new URL(process.env.FRONTEND_URL).origin;
    trustedOrigins.push(origin);
  } catch (e) { }
}
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach(o => {
    if (o.trim()) trustedOrigins.push(o.trim().replace(/\/+$/, ''));
  });
}

function isOriginAllowed(origin) {
  if (!origin) return true; // Allow non-browser agents (cURL, Postman, mobile apps)

  const clean = origin.trim().replace(/\/+$/, '');

  // Exact match in trusted list
  if (trustedOrigins.includes(clean)) return true;

  try {
    const url = new URL(clean);
    const hostname = url.hostname.toLowerCase();

    // Allow any localhost / 127.0.0.1 port (for local dev across different ports)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return true;
    }

    // Allow official subdomains
    if (
      hostname === 'wipronix.com' ||
      hostname.endsWith('.wipronix.com') ||
      hostname === 'wipronix-website.web.app' ||
      hostname === 'internship-1b6cd.web.app' ||
      hostname.endsWith('.web.app') ||
      hostname.endsWith('.vercel.app')
    ) {
      return true;
    }
  } catch (e) {
    return false;
  }

  return false;
}

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS BLOCKED] Rejected unauthorized origin: "${origin}"`);
      callback(new Error(`Blocked by CORS policy: Origin "${origin}" is not authorized.`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-Student-Id"],
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

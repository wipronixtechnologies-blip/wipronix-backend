/**
 * Trusted domains for CORS origin validation.
 * Strictly restricts cross-origin access to authorized frontends.
 */

const defaultAllowedOrigins = [
  "https://wipronix.com",
  "https://www.wipronix.com",
  "https://admin.wipronix.com",
  "http://admin.wipronix.com",
  "https://wipronix-admin-pannel.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080"
];

// Allow optional extension via environment variable without code changes
const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));

/**
 * Checks whether an incoming origin header is in the trusted origins whitelist.
 * Allows non-browser requests (e.g. server-to-server, curl, Postman, cron) where origin is undefined.
 *
 * @param {string|undefined} origin
 * @returns {boolean}
 */
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, "");
  return allowedOrigins.includes(normalized);
};

module.exports = {
  allowedOrigins,
  isAllowedOrigin
};

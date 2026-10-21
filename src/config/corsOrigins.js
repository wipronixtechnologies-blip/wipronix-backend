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
  if (allowedOrigins.includes(normalized)) return true;

  // Development only: allow the Vite dev servers when opened via a private LAN IP
  if (process.env.NODE_ENV === "development") {
    const lanDevOrigin = /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):(5173|8080)$/;
    if (lanDevOrigin.test(normalized)) return true;
  }

  return false;
};

module.exports = {
  allowedOrigins,
  isAllowedOrigin
};

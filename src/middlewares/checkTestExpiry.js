const redis = require("../config/redis");
const autoSubmit = require("../services/autoSubmit");

const checkTestExpiry = async (req, res, next) => {
  try {
    const studentId = (req.body && req.body.studentId) || req.query.studentId
console.log(req.body);
console.log(req.query);
console.log('Checking test expiry for student:', studentId);

    if (!studentId) return next();

    const sessionKey = `test:session:${studentId}`;
    const ttl = await redis.ttl(sessionKey);

    // TTL expired → auto submit
    if (ttl <= 0) {
      await autoSubmit(studentId);

      return res.status(403).json({
        success: false,
        message: "Time up. Test auto-submitted."
      });
    }

    next();
  } catch (error) {
    // Set CORS headers before calling next(error) to ensure error responses have CORS
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'https://internship-1b6cd.web.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    
    next(error);
  }
};

module.exports = checkTestExpiry;

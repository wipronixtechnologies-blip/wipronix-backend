const express = require("express");
const router = express.Router();

const apiRoutes = require("./api/index");

// All valid API routes
router.use("/api", (req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.originalUrl}`);
  next();
}, apiRoutes);

// Fallback for unknown /api routes
router.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

module.exports = router;

const { Router } = require("express");

const router = Router();

router.get("/", (req, res) => {
  res.json({
    service: "Test Service",
    status: "UP",
    environment: process.env.VERCEL ? "serverless" : "local",
    timestamp: new Date()
  });
});

module.exports = router;

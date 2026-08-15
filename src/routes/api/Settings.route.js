const express = require('express');
const router = express.Router();
const settingsController = require('../../../controllers/Settings/Settings.controller');
// Add verifySMTP route
router.post('/verify-smtp', settingsController.verifySMTP);

module.exports = router;

const express = require('express');
const router = express.Router();
const settingsController = require('../../../controllers/Settings/Settings.controller');
// Add verifySMTP route
router.post('/verify-smtp', settingsController.verifySMTP);
router.post('/email', settingsController.saveEmailSettings);
router.post('/general', settingsController.saveGeneralSettings);

module.exports = router;

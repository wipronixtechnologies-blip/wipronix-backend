const express = require('express');
const router = express.Router();
const submitContact = require('../../../controllers/Contact/submitContact');

// Public route to submit contact inquiries
router.post('/submit', submitContact);

module.exports = router;

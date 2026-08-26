const express = require('express');
const router = express.Router();

const dropdownOptionController = require('../../../controllers/DropdownOption/dropdownOptionController');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

// Public route to fetch dropdown options
router.get('/', dropdownOptionController.getAllOptions);

// All write operations require staff authentication
router.use(authenticateStaff);

router.post('/', dropdownOptionController.createOption);
router.put('/:id', dropdownOptionController.updateOption);
router.delete('/:id', dropdownOptionController.deleteOption);

module.exports = router;

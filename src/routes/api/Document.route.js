const express = require('express');
const router = express.Router();
const documentController = require('../../../controllers/Document/documentController');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

router.use(authenticateStaff);

router.get('/', documentController.getMyDocuments);
router.get('/staff/:staffId', documentController.getStaffDocuments);
router.post('/upload', documentController.uploadDocument);
router.delete('/reset', documentController.resetMyDocuments);
router.patch('/:id/verify', documentController.verifyDocument);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;

const express = require('express');
const router = express.Router();
const performanceController = require('../../../controllers/Performance/performanceController');
const { authenticateStaff } = require('../../../controllers/Auth/staffProfile');

router.use(authenticateStaff);

router.get('/my', performanceController.getMyReviews);
router.get('/goals', performanceController.getMyGoals);
router.get('/stats', performanceController.getPerformanceStats);
router.get('/:reviewId', performanceController.getReviewById);
router.post('/:reviewId/acknowledge', performanceController.acknowledgeReview);
// Create review likely admin only, omitting for now or adding with check
// router.post('/', performanceController.createReview);

module.exports = router;

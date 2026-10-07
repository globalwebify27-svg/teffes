const { Router } = require('express');
const { getProductReviews, addReview } = require('../controllers/reviewController');
const { protect } = require('../middlewares/auth');

const router = Router();

router.get('/:productId', getProductReviews);
router.get('/product/:productId', getProductReviews);
router.post('/', protect, addReview);

module.exports = router;

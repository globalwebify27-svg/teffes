const { Router } = require('express');
const { getActiveCoupons, validateCoupon } = require('../controllers/couponController');
const { protect } = require('../middlewares/auth');

const router = Router();

router.get('/active', getActiveCoupons);
router.post('/validate', protect, validateCoupon);

module.exports = router;

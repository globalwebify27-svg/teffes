const { Router } = require('express');
const { getActiveCoupons, getSuperOffer, validateCoupon } = require('../controllers/couponController');
const { protect } = require('../middlewares/auth');

const router = Router();

router.get('/active', getActiveCoupons);
router.get('/super-offer', getSuperOffer);
router.post('/validate', protect, validateCoupon);

module.exports = router;

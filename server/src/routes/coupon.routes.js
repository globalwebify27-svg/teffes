const { Router } = require('express');
const {
  getActiveCoupons,
  getSuperOffer,
  applyCoupon,
  validateCoupon,
} = require('../controllers/couponController');
const { optionalProtect } = require('../middlewares/auth');

const router = Router();

// Public discovery endpoints
router.get('/active', getActiveCoupons);
router.get('/super-offer', getSuperOffer);

// Coupon application endpoints (supports both authenticated and guest carts with user extraction)
router.post('/apply', optionalProtect, applyCoupon);
router.post('/validate', optionalProtect, validateCoupon);

module.exports = router;

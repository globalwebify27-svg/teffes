const { Router } = require('express');
const {
  getActiveCoupons,
  getSuperOffer,
  getMyTier,
  applyCoupon,
  validateCoupon,
} = require('../controllers/couponController');
const { optionalProtect } = require('../middlewares/auth');

const router = Router();

// Public / Tier-filtered discovery endpoints
router.get('/active', optionalProtect, getActiveCoupons);
router.get('/super-offer', optionalProtect, getSuperOffer);
router.get('/my-tier', optionalProtect, getMyTier);

// Coupon application endpoints (supports both authenticated and guest carts with user extraction)
router.post('/apply', optionalProtect, applyCoupon);
router.post('/validate', optionalProtect, validateCoupon);

module.exports = router;

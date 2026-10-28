const {
  getActiveCoupons: getActiveCouponsFS,
  getCouponByCode,
  calculateDiscount,
  isCouponExpired,
  isCouponFuture,
} = require('../services/firestore/coupon.firestore.service');
const { validateCouponEligibility } = require('../utils/couponCalculator');

/**
 * GET /api/coupons/active
 * Retrieve all currently active, non-expired coupons within their validity window
 */
exports.getActiveCoupons = async (req, res, next) => {
  try {
    const activeCoupons = await getActiveCouponsFS();
    res.status(200).json({
      success: true,
      count: activeCoupons.length,
      coupons: activeCoupons,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/coupons/super-offer
 * Get the designated Super Offer (or fallback to latest active coupon)
 */
exports.getSuperOffer = async (req, res, next) => {
  try {
    const activeCoupons = await getActiveCouponsFS();
    if (activeCoupons.length === 0) {
      return res.status(200).json({ success: true, superOffer: null });
    }

    let superOffer = activeCoupons.find((c) => c.isSuperOffer === true);
    if (!superOffer) {
      superOffer = activeCoupons[0];
    }

    res.status(200).json({ success: true, superOffer });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/coupons/apply
 * Customer explicitly applies a coupon to their cart.
 */
exports.applyCoupon = async (req, res, next) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a coupon code.',
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const amount = Number(cartTotal);

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart total must be greater than 0 to apply a coupon.',
      });
    }

    const coupon = await getCouponByCode(cleanCode);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found.',
      });
    }

    if (coupon.isActive === false || coupon.status === 'Paused') {
      return res.status(400).json({
        success: false,
        message: 'Coupon is currently inactive.',
      });
    }

    if (isCouponFuture(coupon.validFrom)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is not active yet.',
      });
    }

    if (isCouponExpired(coupon.validTill) || coupon.status === 'Expired') {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired.',
      });
    }

    const minReq = coupon.minOrderAmount || coupon.minOrder || 0;
    if (amount < minReq) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount for this coupon is ₹${minReq}`,
      });
    }

    const usageLimit = Number(coupon.usageLimit);
    const usage = Number(coupon.usageCount || coupon.used || 0);
    if (usageLimit && usageLimit > 0 && usage >= usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit has been reached.',
      });
    }

    const discount = calculateDiscount(coupon, amount);
    const payableAmount = Math.max(0, amount - discount);

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully.',
      couponCode: coupon.code,
      discount,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
      minOrderAmount: coupon.minOrderAmount || coupon.minOrder || 0,
      payableAmount,
      coupon: {
        id: coupon.code,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderAmount: coupon.minOrderAmount || coupon.minOrder || 0,
        maxDiscountAmount: coupon.maxDiscountAmount,
        description: coupon.description || coupon.discount,
        isSuperOffer: coupon.isSuperOffer,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/coupons/validate
 * Backward-compatible endpoint for existing clients calling /validate
 */
exports.validateCoupon = async (req, res, next) => {
  return exports.applyCoupon(req, res, next);
};

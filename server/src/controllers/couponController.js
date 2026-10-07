const Coupon = require('../models/Coupon');
const {
  isCouponExpired,
  isCouponFuture,
  validateCouponEligibility,
  calculateDiscount,
} = require('../utils/couponCalculator');

/**
 * GET /api/coupons/active
 * Retrieve all currently active, non-expired coupons within their validity window
 */
exports.getActiveCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({
      isActive: { $ne: false },
      status: { $ne: 'Paused' },
    }).sort({ isSuperOffer: -1, createdAt: -1 });

    const activeCoupons = coupons.filter(
      (c) => !isCouponExpired(c.validTill) && !isCouponFuture(c.validFrom)
    );

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
    const coupons = await Coupon.find({
      isActive: { $ne: false },
      status: { $ne: 'Paused' },
    }).sort({ createdAt: -1 });

    const activeCoupons = coupons.filter(
      (c) => !isCouponExpired(c.validTill) && !isCouponFuture(c.validFrom)
    );

    if (activeCoupons.length === 0) {
      return res.status(200).json({ success: true, superOffer: null });
    }

    // 1. Look for explicitly chosen Super Offer
    let superOffer = activeCoupons.find((c) => c.isSuperOffer === true);

    // 2. Fallback: if none selected by Super Admin, latest active offer becomes the Super Offer
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
 * Backend is the source of truth for validation and discount calculation.
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

    const coupon = await Coupon.findOne({ code: cleanCode });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found.',
      });
    }

    // Comprehensive backend validation (active status, dates, min order, usage limit, first order, per-user single use)
    const eligibility = await validateCouponEligibility(coupon, amount, req.user || null);

    if (!eligibility.isValid) {
      return res.status(400).json({
        success: false,
        message: eligibility.error,
      });
    }

    const discount = eligibility.discount;
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
        id: coupon._id,
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

const {
  getActiveCoupons: getActiveCouponsFS,
  getCouponByCode,
  calculateDiscount,
  isCouponExpired,
  isCouponFuture,
} = require('../services/firestore/coupon.firestore.service');
const { validateCouponEligibility } = require('../utils/couponCalculator');
const { calculateCustomerMonthlyTier } = require('../utils/tierCalculator');

/**
 * GET /api/coupons/active
 * Retrieve all currently active, non-expired coupons visible for the user's tier.
 */
exports.getActiveCoupons = async (req, res, next) => {
  try {
    const allActive = await getActiveCouponsFS();
    let userTier = 'bronze';

    if (req.user) {
      const tierInfo = await calculateCustomerMonthlyTier(req.user);
      userTier = (tierInfo.tier || 'bronze').toLowerCase();
    }

    // Filter coupons: must be 'general' OR match user's monthly tier
    const visibleCoupons = allActive.filter((c) => {
      const rawTargetTiers = Array.isArray(c.targetTiers)
        ? c.targetTiers.map((t) => String(t).toLowerCase().trim())
        : (c.targetTier ? [String(c.targetTier).toLowerCase().trim()] : ['general']);

      if (rawTargetTiers.length === 0 || rawTargetTiers.includes('general')) {
        return true;
      }

      if (!req.user) {
        return false;
      }

      return rawTargetTiers.includes(userTier);
    });

    res.status(200).json({
      success: true,
      count: visibleCoupons.length,
      coupons: visibleCoupons,
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
    const allActive = await getActiveCouponsFS();
    if (allActive.length === 0) {
      return res.status(200).json({ success: true, superOffer: null });
    }

    let userTier = 'bronze';
    if (req.user) {
      const tierInfo = await calculateCustomerMonthlyTier(req.user);
      userTier = (tierInfo.tier || 'bronze').toLowerCase();
    }

    // Filter visible coupons
    const visibleCoupons = allActive.filter((c) => {
      const rawTargetTiers = Array.isArray(c.targetTiers)
        ? c.targetTiers.map((t) => String(t).toLowerCase().trim())
        : (c.targetTier ? [String(c.targetTier).toLowerCase().trim()] : ['general']);

      if (rawTargetTiers.length === 0 || rawTargetTiers.includes('general')) return true;
      if (!req.user) return false;
      return rawTargetTiers.includes(userTier);
    });

    if (visibleCoupons.length === 0) {
      return res.status(200).json({ success: true, superOffer: null });
    }

    let superOffer = visibleCoupons.find((c) => c.isSuperOffer === true);
    if (!superOffer) {
      superOffer = visibleCoupons[0];
    }

    res.status(200).json({ success: true, superOffer });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/coupons/my-tier
 * Retrieve authenticated customer's monthly loyalty tier and spend metrics
 */
exports.getMyTier = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(200).json({
        success: true,
        tierInfo: {
          monthlySpend: 0,
          tier: 'Bronze',
          nextTier: 'Silver',
          spendNeededForNextTier: 800,
        },
      });
    }

    const tierInfo = await calculateCustomerMonthlyTier(req.user);
    res.status(200).json({
      success: true,
      tierInfo,
    });
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

    // Comprehensive eligibility check (dates, status, min order, usage limits, first order, loyalty tier)
    const eligibility = await validateCouponEligibility(coupon, amount, req.user);
    if (!eligibility.isValid) {
      return res.status(400).json({
        success: false,
        message: eligibility.error,
      });
    }

    const discount = eligibility.discount !== undefined ? eligibility.discount : calculateDiscount(coupon, amount);
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
        targetTiers: coupon.targetTiers || ['general'],
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

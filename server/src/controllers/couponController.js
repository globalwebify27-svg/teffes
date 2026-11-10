const {
  getActiveCoupons: getActiveCouponsFS,
  getCouponByCode,
  calculateDiscount,
  isCouponExpired,
  isCouponFuture,
} = require('../services/firestore/coupon.firestore.service');
const { validateCouponEligibility } = require('../utils/couponCalculator');
const { calculateCustomerMonthlyTier } = require('../utils/tierCalculator');

// Helper to ensure clean, human-readable discount strings and dates
const formatCouponData = (c) => {
  if (!c) return null;
  const discountType = c.discountType || 'fixed';
  const discountVal = Number(c.discountValue || 0);
  let discountStr = '';

  if (c.discount && typeof c.discount === 'string' && c.discount.trim() && isNaN(Number(c.discount))) {
    discountStr = c.discount.trim();
  } else if (discountType === 'percentage') {
    discountStr = `${discountVal}% OFF`;
  } else if (discountType === 'free_delivery') {
    discountStr = 'Free Express Delivery';
  } else if (discountVal > 0) {
    discountStr = `Flat ₹${discountVal} OFF`;
  } else {
    discountStr = c.description || 'Special Promotional Offer';
  }

  let formattedDate = c.validTill || '';
  if (formattedDate && typeof formattedDate === 'string' && formattedDate.includes('T')) {
    const d = new Date(formattedDate);
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }

  const minOrder = Number(c.minOrderAmount !== undefined ? c.minOrderAmount : (c.minOrder || 0));

  return {
    ...c,
    _id: c.code || c.id || c._id,
    id: c.code || c.id || c._id,
    code: c.code,
    discount: discountStr,
    discountType,
    discountValue: discountVal,
    minOrder,
    minOrderAmount: minOrder,
    validTill: formattedDate,
    description: c.description || discountStr,
    isSuperOffer: c.isSuperOffer === true,
  };
};

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

    const formattedCoupons = visibleCoupons.map(formatCouponData);

    res.status(200).json({
      success: true,
      count: formattedCoupons.length,
      coupons: formattedCoupons,
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

    res.status(200).json({
      success: true,
      superOffer: formatCouponData(superOffer),
    });
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
    const { code, cartTotal, amount: reqAmount } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({
        success: false,
        valid: false,
        isValid: false,
        message: 'Please provide a coupon code.',
        error: 'Please provide a coupon code.',
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const rawAmount = cartTotal !== undefined ? cartTotal : reqAmount;
    const amount = Number(rawAmount);

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        valid: false,
        isValid: false,
        message: 'Cart total must be greater than 0 to apply a coupon.',
        error: 'Cart total must be greater than 0 to apply a coupon.',
      });
    }

    const coupon = await getCouponByCode(cleanCode);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        valid: false,
        isValid: false,
        message: 'Coupon not found.',
        error: 'Coupon not found.',
      });
    }

    // Comprehensive eligibility check (dates, status, min order, usage limits, first order, loyalty tier)
    const eligibility = await validateCouponEligibility(coupon, amount, req.user);
    if (!eligibility.isValid) {
      return res.status(400).json({
        success: false,
        valid: false,
        isValid: false,
        message: eligibility.error,
        error: eligibility.error,
      });
    }

    const discount = eligibility.discount !== undefined ? eligibility.discount : calculateDiscount(coupon, amount);
    const payableAmount = Math.max(0, amount - discount);
    const formatted = formatCouponData(coupon);

    res.status(200).json({
      success: true,
      valid: true,
      isValid: true,
      message: 'Coupon applied successfully.',
      couponCode: coupon.code,
      discount,
      discountAmount: discount,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
      minOrderAmount: formatted.minOrder,
      payableAmount,
      finalAmount: payableAmount,
      coupon: {
        id: coupon.code,
        code: coupon.code,
        discount: formatted.discount,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderAmount: formatted.minOrder,
        minOrder: formatted.minOrder,
        maxDiscountAmount: coupon.maxDiscountAmount,
        description: formatted.description,
        isSuperOffer: coupon.isSuperOffer === true,
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

/**
 * Authoritative Coupon Calculator (Pure Cloud Firestore Backend)
 * 100% Zero MongoDB dependency - Fully migrated to Google Cloud Firestore
 */

const { getUserOrders } = require('../services/firestore/order.firestore.service');

/**
 * Helper to check if a coupon date has passed
 */
const isCouponExpired = (validTill) => {
  if (!validTill) return false;
  const parsed = new Date(validTill);
  if (!isNaN(parsed.getTime())) {
    const endOfDay = new Date(parsed);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay < new Date();
  }
  return false;
};

/**
 * Helper to check if a coupon is not yet active
 */
const isCouponFuture = (validFrom) => {
  if (!validFrom) return false;
  const parsed = new Date(validFrom);
  if (!isNaN(parsed.getTime())) {
    return parsed > new Date();
  }
  return false;
};

/**
 * Calculate the authoritative discount amount based on order amount and coupon parameters.
 * Never allows discount to make payable amount negative.
 */
const calculateDiscount = (coupon, orderAmount) => {
  if (!coupon || !orderAmount || orderAmount <= 0) return 0;

  const value = Number(coupon.discountValue) || 0;
  let discount = 0;

  if (coupon.discountType === 'percentage') {
    discount = Math.round((orderAmount * value) / 100);
    const maxCap = Number(coupon.maxDiscountAmount);
    if (maxCap && maxCap > 0) {
      discount = Math.min(discount, maxCap);
    }
  } else if (coupon.discountType === 'free_delivery') {
    discount = 40;
  } else {
    discount = value;
  }

  return Math.min(Math.max(0, discount), orderAmount);
};

/**
 * Full backend coupon validation against business rules.
 */
const validateCouponEligibility = async (coupon, orderAmount, user = null) => {
  if (!coupon) {
    return { isValid: false, error: 'Coupon not found.' };
  }

  // 1. Active status check
  if (coupon.isActive === false || coupon.status === 'Paused') {
    return { isValid: false, error: 'Coupon is currently inactive.' };
  }

  // 2. Future date check
  if (isCouponFuture(coupon.validFrom)) {
    return { isValid: false, error: 'Coupon is not active yet.' };
  }

  // 3. Expiration check
  if (isCouponExpired(coupon.validTill) || coupon.status === 'Expired') {
    return { isValid: false, error: 'Coupon has expired.' };
  }

  // 4. Minimum order amount check
  const minRequired = coupon.minOrderAmount !== undefined ? coupon.minOrderAmount : (coupon.minOrder || 0);
  if (orderAmount < minRequired) {
    return { isValid: false, error: `Minimum order amount is ₹${minRequired}.` };
  }

  // 5. Total usage limit check
  const usageLimit = Number(coupon.usageLimit);
  const currentUsage = Number(coupon.usageCount || coupon.used || 0);
  if (usageLimit && usageLimit > 0 && currentUsage >= usageLimit) {
    return { isValid: false, error: 'Coupon usage limit has been reached.' };
  }

  // 6. First order only check
  if (coupon.firstOrderOnly) {
    if (!user || (!user._id && !user.id)) {
      return { isValid: false, error: 'This coupon is valid only for your first order. Please login to apply.' };
    }
    const userId = String(user._id || user.id);
    const userOrders = await getUserOrders(userId);
    const completedOrders = userOrders.filter((o) => o.status !== 'Cancelled');
    if (completedOrders.length > 0) {
      return { isValid: false, error: 'This coupon is valid only for your first order.' };
    }
  }

  // 7. Single use per customer check
  if (user && (user._id || user.id)) {
    const userId = String(user._id || user.id);
    const userOrders = await getUserOrders(userId);
    const alreadyUsed = userOrders.some(
      (o) =>
        o.status !== 'Cancelled' &&
        (o.couponCode === coupon.code || o.coupon?.code === coupon.code)
    );
    if (alreadyUsed) {
      return { isValid: false, error: 'You have already used this coupon.' };
    }
  }

  // 8. Calculate authoritative discount
  const discount = calculateDiscount(coupon, orderAmount);

  return {
    isValid: true,
    discount,
  };
};

module.exports = {
  isCouponExpired,
  isCouponFuture,
  calculateDiscount,
  validateCouponEligibility,
};

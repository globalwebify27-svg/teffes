const {
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
} = require('../../lib/firestore');

const COLLECTION = 'coupons';

const normalizeCode = (code) => {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
};

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

const isCouponFuture = (validFrom) => {
  if (!validFrom) return false;
  const parsed = new Date(validFrom);
  if (!isNaN(parsed.getTime())) {
    return parsed > new Date();
  }
  return false;
};

/**
 * Calculate authoritative discount amount.
 * Never exceeds order subtotal.
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
    discount = 40; // Standard express delivery fee
  } else {
    discount = value;
  }

  return Math.min(Math.max(0, discount), orderAmount);
};

/**
 * Retrieve coupon by uppercase code.
 */
const getCouponByCode = async (code) => {
  const cleanCode = normalizeCode(code);
  if (!cleanCode) return null;
  return getDoc(COLLECTION, cleanCode);
};

/**
 * Retrieve all currently active coupons.
 */
const getActiveCoupons = async (options = {}) => {
  const coupons = await queryDocs(COLLECTION, (ref) => ref.where('isActive', '==', true));
  return coupons
    .filter(
      (c) =>
        options.includeTest ||
        (!c.isTest &&
          !String(c.code || '').startsWith('E2E_') &&
          !String(c.code || '').startsWith('TEST_'))
    )
    .filter((c) => c.status !== 'Paused' && !isCouponExpired(c.validTill) && !isCouponFuture(c.validFrom))
    .sort((a, b) => {
      if (a.isSuperOffer === b.isSuperOffer) {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      return a.isSuperOffer ? -1 : 1;
    });
};

/**
 * Retrieve designated super offer coupon.
 */
const getSuperOffer = async () => {
  const active = await getActiveCoupons();
  if (active.length === 0) return null;
  return active.find((c) => c.isSuperOffer === true) || active[0];
};

/**
 * Validate coupon eligibility against business rules and user history.
 */
const validateCouponEligibility = async ({ couponCode, orderAmount, userId = null, userPhone = null }) => {
  const cleanCode = normalizeCode(couponCode);
  if (!cleanCode) {
    return { isValid: false, error: 'Coupon code is required' };
  }

  const coupon = await getCouponByCode(cleanCode);
  if (!coupon) {
    return { isValid: false, error: 'Coupon not found' };
  }

  if (coupon.isActive === false || coupon.status === 'Paused') {
    return { isValid: false, error: 'Coupon is currently inactive' };
  }

  if (isCouponFuture(coupon.validFrom)) {
    return { isValid: false, error: 'Coupon is not active yet' };
  }

  if (isCouponExpired(coupon.validTill) || coupon.status === 'Expired') {
    return { isValid: false, error: 'Coupon has expired' };
  }

  const minRequired = coupon.minOrderAmount || coupon.minOrder || 0;
  if (Number(orderAmount) < minRequired) {
    return { isValid: false, error: `Minimum order amount is ₹${minRequired}` };
  }

  const usageLimit = Number(coupon.usageLimit);
  const currentUsage = Number(coupon.usageCount || coupon.used || 0);
  if (usageLimit && usageLimit > 0 && currentUsage >= usageLimit) {
    return { isValid: false, error: 'Coupon usage limit has been reached' };
  }

  const discount = calculateDiscount(coupon, Number(orderAmount));

  return {
    isValid: true,
    coupon,
    discount,
  };
};

/**
 * Safely create a new coupon document.
 */
const createCoupon = async (data = {}) => {
  if (!data.code || typeof data.code !== 'string' || !data.code.trim()) {
    throw new Error('Coupon code is required');
  }

  const cleanCode = normalizeCode(data.code);
  const existing = await getDoc(COLLECTION, cleanCode);
  if (existing) {
    throw new Error(`Coupon with code "${cleanCode}" already exists`);
  }

  const discountType = ['percentage', 'fixed', 'free_delivery'].includes(data.discountType)
    ? data.discountType
    : 'percentage';

  const payload = {
    code: cleanCode,
    description: (data.description || data.discount || '').trim(),
    discount: (data.discount || data.description || '').trim(),
    discountType,
    discountValue: Math.max(0, Number(data.discountValue) || 0),
    minOrderAmount: Math.max(0, Number(data.minOrderAmount || data.minOrder) || 0),
    minOrder: Math.max(0, Number(data.minOrderAmount || data.minOrder) || 0),
    maxDiscountAmount: data.maxDiscountAmount ? Math.max(0, Number(data.maxDiscountAmount)) : null,
    validFrom: data.validFrom || new Date().toISOString(),
    validTill: data.validTill || new Date('2026-12-31T23:59:59.999Z').toISOString(),
    firstOrderOnly: Boolean(data.firstOrderOnly),
    usageLimit: data.usageLimit ? Math.max(1, Number(data.usageLimit)) : null,
    usageCount: 0,
    used: 0,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    status: ['Active', 'Expired', 'Paused'].includes(data.status) ? data.status : 'Active',
    isSuperOffer: Boolean(data.isSuperOffer),
  };

  return createDoc(COLLECTION, cleanCode, payload, { overwrite: false });
};

/**
 * Safely update an existing coupon.
 */
const updateCoupon = async (code, updates = {}) => {
  const cleanCode = normalizeCode(code);
  if (!cleanCode) throw new Error('Valid coupon code is required for update');

  const existing = await getDoc(COLLECTION, cleanCode);
  if (!existing) {
    throw new Error(`Coupon with code "${cleanCode}" not found`);
  }

  const payload = { ...updates };
  delete payload.code;
  delete payload.id;
  delete payload._id;

  if (payload.minOrderAmount !== undefined) {
    payload.minOrder = payload.minOrderAmount;
  }
  if (payload.usageCount !== undefined) {
    payload.used = payload.usageCount;
  }

  return updateDoc(COLLECTION, cleanCode, payload);
};

/**
 * Safely delete a coupon.
 */
const deleteCoupon = async (code) => {
  const cleanCode = normalizeCode(code);
  if (!cleanCode) throw new Error('Valid coupon code is required for deletion');

  const existing = await getDoc(COLLECTION, cleanCode);
  if (!existing) {
    throw new Error(`Coupon with code "${cleanCode}" not found`);
  }

  await deleteDoc(COLLECTION, cleanCode);
  return true;
};

module.exports = {
  COLLECTION,
  normalizeCode,
  isCouponExpired,
  isCouponFuture,
  calculateDiscount,
  getCouponByCode,
  getActiveCoupons,
  getSuperOffer,
  validateCouponEligibility,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};

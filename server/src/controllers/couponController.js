const Coupon = require('../models/Coupon');

// Helper to verify if coupon validity date has passed
const isExpired = (validTill) => {
  if (!validTill) return false;
  const parsed = new Date(validTill);
  if (!isNaN(parsed.getTime())) {
    // Treat date as valid until end of specified day
    parsed.setHours(23, 59, 59, 999);
    return parsed < new Date();
  }
  return false;
};

// Get all active coupons (for homepage/cart display/offers page)
exports.getActiveCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ status: 'Active' }).sort({ createdAt: -1 });
    const activeCoupons = coupons.filter(c => !isExpired(c.validTill));
    res.status(200).json({ success: true, count: activeCoupons.length, coupons: activeCoupons });
  } catch (error) {
    next(error);
  }
};

// Get the designated Super Offer (or fallback to first latest active coupon)
exports.getSuperOffer = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ status: 'Active' }).sort({ createdAt: -1 });
    const activeCoupons = coupons.filter(c => !isExpired(c.validTill));
    
    if (activeCoupons.length === 0) {
      return res.status(200).json({ success: true, superOffer: null });
    }

    // 1. Look for explicitly chosen Super Offer
    let superOffer = activeCoupons.find(c => c.isSuperOffer === true);

    // 2. Fallback: if none selected by Super Admin, latest active offer becomes the Super Offer
    if (!superOffer) {
      superOffer = activeCoupons[0];
    }

    res.status(200).json({ success: true, superOffer });
  } catch (error) {
    next(error);
  }
};

// Validate a specific coupon code during checkout
exports.validateCoupon = async (req, res, next) => {
  try {
    const { code, cartTotal } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, message: 'Please provide a coupon code' });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), status: 'Active' });
    
    if (!coupon || isExpired(coupon.validTill)) {
      return res.status(404).json({ success: false, message: 'Invalid or expired coupon code' });
    }

    // Check min order value
    if (cartTotal < coupon.minOrder) {
      return res.status(400).json({ 
        success: false, 
        message: `This coupon requires a minimum order of ₹${coupon.minOrder}` 
      });
    }

    res.status(200).json({ success: true, coupon });
  } catch (error) {
    next(error);
  }
};

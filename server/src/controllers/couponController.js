const Coupon = require('../models/Coupon');

// Get all active coupons (for homepage/cart display)
exports.getActiveCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ status: 'Active' });
    res.status(200).json({ success: true, count: coupons.length, coupons });
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
    
    if (!coupon) {
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

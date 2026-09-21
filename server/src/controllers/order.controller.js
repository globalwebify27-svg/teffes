const Order = require('../models/Order');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const mongoose = require('mongoose');
const { calculateTargetDeliveryTime, getEtaDetails } = require('../utils/etaCalculator');
const { validateCouponEligibility } = require('../utils/couponCalculator');

const generateOrderId = () => {
  return 'TEF-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

/**
 * POST /api/orders
 * Create a new order
 */
const createOrder = async (req, res, next) => {
  let couponDocToRollback = null;
  try {
    const {
      items,
      amount,
      totalAmount,
      storeId,
      storeName,
      deliverySlot,
      paymentMethod,
      paymentStatus,
      razorpayOrderId,
      razorpayPaymentId,
      addressId,
      pickupMode,
      fulfillmentType,
      shippingAddress,
    } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order items cannot be empty' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Calculate authoritative items subtotal directly from items
    const itemsSubtotal = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );

    // Determine whether order is Store Pickup or Home Delivery
    const isPickup =
      pickupMode === true ||
      fulfillmentType === 'pickup' ||
      deliverySlot?.toLowerCase().includes('pickup') ||
      shippingAddress?.toLowerCase().includes('store pickup');

    const resolvedFulfillmentType = isPickup ? 'pickup' : 'delivery';

    // ─── Authoritative Coupon Revalidation at Place Order ───
    let verifiedDiscount = 0;
    let verifiedCouponSnapshot = null;
    const incomingCouponCode = (req.body.couponCode || req.body.coupon?.code || '').trim().toUpperCase();

    if (incomingCouponCode) {
      const couponDoc = await Coupon.findOne({ code: incomingCouponCode });
      if (!couponDoc) {
        return res.status(400).json({
          success: false,
          message: 'Coupon is no longer valid. Please try another coupon.',
        });
      }

      // Revalidate all coupon rules against actual items subtotal and user order history
      const eligibility = await validateCouponEligibility(couponDoc, itemsSubtotal, user);
      if (!eligibility.isValid) {
        return res.status(400).json({
          success: false,
          message: eligibility.error || 'Coupon is no longer valid. Please try another coupon.',
        });
      }

      // Concurrency guard: Atomically increment usageCount only if usageLimit not exceeded
      const usageLimit = Number(couponDoc.usageLimit);
      const updateFilter = { _id: couponDoc._id };
      if (usageLimit && usageLimit > 0) {
        updateFilter.$or = [
          { usageCount: { $lt: usageLimit } },
          { used: { $lt: usageLimit } },
        ];
      }

      const incrementedCoupon = await Coupon.findOneAndUpdate(
        updateFilter,
        { $inc: { usageCount: 1, used: 1 } },
        { new: true }
      );

      if (!incrementedCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Coupon usage limit has been reached.',
        });
      }

      couponDocToRollback = incrementedCoupon._id;
      verifiedDiscount = eligibility.discount;
      verifiedCouponSnapshot = {
        code: couponDoc.code,
        discountType: couponDoc.discountType,
        discountValue: couponDoc.discountValue,
        discountAmount: verifiedDiscount,
      };
    }

    const standardDeliveryFee = isPickup ? 0 : (itemsSubtotal >= 399 ? 0 : 40);
    const tipAmount = Number(req.body.tip) || 0;
    const computedFinalAmount = Math.max(0, itemsSubtotal + standardDeliveryFee + tipAmount - verifiedDiscount);
    const finalAmount = amount !== undefined ? amount : (totalAmount !== undefined ? totalAmount : computedFinalAmount);

    let orderAddress = isPickup
      ? '🏪 Store Pickup: Kishore Ganj Hub, Harmu Road, Ranchi (Takeaway Counter)'
      : (shippingAddress || 'Ranchi Delivery');

    if (!isPickup && addressId) {
      const addr = user.addresses ? user.addresses.id(addressId) : null;
      if (addr) {
        orderAddress = `${addr.line1}, ${addr.line2 ? addr.line2 + ', ' : ''}${addr.city} - ${addr.pincode}`;
      } else if (!shippingAddress) {
        if (couponDocToRollback) {
          await Coupon.updateOne({ _id: couponDocToRollback }, { $inc: { usageCount: -1, used: -1 } }).catch(() => {});
        }
        return res.status(400).json({ success: false, message: 'Invalid address selected' });
      }
    }

    const isOnline = paymentMethod?.toLowerCase().includes('online') || paymentMethod?.toLowerCase().includes('razorpay');

    // Dynamic initial ETA calculation
    const prepMinutes = Number(req.body.prepTimeMinutes) || 25;
    const initialTransit = isPickup ? 0 : 15;
    const targetDelivery = calculateTargetDeliveryTime(new Date(), prepMinutes, initialTransit);

    const newOrder = new Order({
      orderId: generateOrderId(),
      customer: {
        name: user.name || 'Valued Customer',
        phone: user.phone || '9999999999',
        email: user.email || '',
        userId: user._id,
        address: orderAddress,
        lat: req.body.customerLat || 23.3512,
        lng: req.body.customerLng || 85.3154,
      },
      items,
      amount: finalAmount,
      storeId: storeId || 'S001',
      storeName: storeName || 'Kishore Ganj',
      deliverySlot: isPickup ? 'Store Pickup (Counter Takeaway)' : (deliverySlot || '90 Mins Express Delivery'),
      fulfillmentType: resolvedFulfillmentType,
      pickupMode: isPickup,
      prepTimeMinutes: prepMinutes,
      targetDeliveryTime: targetDelivery,
      remainingTransitMinutes: initialTransit,
      etaStage: 'PREPARING',
      paymentMethod: paymentMethod || (isPickup ? 'Pay at Store Counter' : 'Cash on Delivery'),
      paymentStatus: paymentStatus || (isOnline ? 'Paid' : 'Pending'),
      razorpayOrderId: razorpayOrderId || '',
      razorpayPaymentId: razorpayPaymentId || '',
      couponCode: verifiedCouponSnapshot ? verifiedCouponSnapshot.code : null,
      discountAmount: verifiedDiscount,
      coupon: verifiedCouponSnapshot,
      status: 'Pending',
    });

    // If payment method is wallet, check balance and deduct
    if (paymentMethod === 'wallet' || paymentMethod === 'Wallet' || paymentMethod === 'Teffes Cash' || req.body.paymentMethod === 'wallet') {
      if (user.walletBalance < amount) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      }
      user.walletBalance -= amount;
      newOrder.paymentMethod = 'Teffes Cash (Wallet)';
      newOrder.paymentStatus = 'Paid';
      
      const WalletTransaction = require('../models/WalletTransaction');
      await WalletTransaction.create({
        userId: user._id,
        type: 'Debit',
        amount: amount,
        description: `Order payment for ${newOrder.orderId}`,
        orderId: newOrder.orderId,
        status: 'Success'
      });
    }

    await newOrder.save();

    // Clear user cart upon successful order creation
    user.cart = [];
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: newOrder,
    });
  } catch (error) {
    if (couponDocToRollback) {
      await Coupon.updateOne({ _id: couponDocToRollback }, { $inc: { usageCount: -1, used: -1 } }).catch(() => {});
    }
    next(error);
  }
};

/**
 * GET /api/orders
 * Get user's orders
 */
const getUserOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ 'customer.userId': req.user._id }).sort({ createdAt: -1 });
    const enrichedOrders = orders.map(o => {
      const obj = o.toObject ? o.toObject() : o;
      obj.etaDetails = getEtaDetails(o);
      return obj;
    });

    res.status(200).json({
      success: true,
      orders: enrichedOrders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders/:id
 * Get order by ID
 */
const getOrderById = async (req, res, next) => {
  try {
    let order = await Order.findOne({ orderId: req.params.id });
    if (!order && mongoose.isValidObjectId(req.params.id)) {
      order = await Order.findById(req.params.id);
    }
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    // Ensure the user owns the order, unless they are admin (simplified check for now)
    if (order.customer.userId && order.customer.userId.toString() !== req.user._id.toString() && !['admin', 'superadmin', 'storeadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const orderObj = order.toObject ? order.toObject() : order;
    orderObj.etaDetails = getEtaDetails(order);

    res.status(200).json({
      success: true,
      order: orderObj,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders/my-orders
 */
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({
      $or: [
        { 'customer.userId': req.user._id },
        { 'customer.phone': req.user.phone },
        { 'customer.email': req.user.email },
      ],
    }).sort({ createdAt: -1 });

    const enrichedOrders = orders.map(o => {
      const obj = o.toObject ? o.toObject() : o;
      obj.etaDetails = getEtaDetails(o);
      return obj;
    });

    res.status(200).json({ success: true, count: enrichedOrders.length, orders: enrichedOrders });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/:orderId/return
 */
const requestReturn = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({
      $or: [{ orderId }, { _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.returnStatus = 'Requested';
    order.returnReason = reason || 'Customer requested return';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Return requested successfully',
      order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/verify-payment
 */
const verifyPayment = async (req, res, next) => {
  try {
    const { orderId, razorpayPaymentId, razorpayOrderId } = req.body;
    const order = await Order.findOne({
      $or: [{ orderId }, { _id: orderId?.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }],
    });

    if (order) {
      order.paymentStatus = 'Paid';
      if (razorpayPaymentId) order.razorpayPaymentId = razorpayPaymentId;
      if (razorpayOrderId) order.razorpayOrderId = razorpayOrderId;
      await order.save();
    }

    res.status(200).json({ success: true, message: 'Payment verified', order });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  getMyOrders,
  requestReturn,
  verifyPayment,
};

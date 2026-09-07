const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

const generateOrderId = () => {
  return 'TEF-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

/**
 * POST /api/orders
 * Create a new order
 */
const createOrder = async (req, res, next) => {
  try {
    const {
      items,
      amount,
      storeId,
      storeName,
      deliverySlot,
      paymentMethod,
      paymentStatus,
      razorpayOrderId,
      razorpayPaymentId,
      addressId,
      pickupMode,
    } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order items cannot be empty' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let orderAddress = 'Store Pickup';
    if (!pickupMode && addressId) {
      const addr = user.addresses ? user.addresses.id(addressId) : null;
      if (addr) {
        orderAddress = `${addr.line1}, ${addr.line2 ? addr.line2 + ', ' : ''}${addr.city} - ${addr.pincode}`;
      } else {
        return res.status(400).json({ success: false, message: 'Invalid address selected' });
      }
    }

    const isOnline = paymentMethod?.toLowerCase().includes('online') || paymentMethod?.toLowerCase().includes('razorpay');

    const newOrder = new Order({
      orderId: generateOrderId(),
      customer: {
        name: user.name || 'Valued Customer',
        phone: user.phone || '9999999999',
        email: user.email || '',
        userId: user._id,
        address: orderAddress,
      },
      items,
      amount,
      storeId: storeId || 'S001',
      storeName: storeName || 'Kishore Ganj',
      deliverySlot: pickupMode ? 'Store Pickup' : (deliverySlot || '90 Mins Express Delivery'),
      paymentMethod: paymentMethod || 'Cash on Delivery',
      paymentStatus: paymentStatus || (isOnline ? 'Paid' : 'Pending'),
      razorpayOrderId: razorpayOrderId || '',
      razorpayPaymentId: razorpayPaymentId || '',
      couponCode: req.body.couponCode || null,
      discountAmount: req.body.discountAmount || 0,
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
    res.status(200).json({
      success: true,
      orders,
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

    res.status(200).json({
      success: true,
      order,
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

    res.status(200).json({ success: true, count: orders.length, orders });
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

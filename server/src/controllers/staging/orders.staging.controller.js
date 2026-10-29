/**
 * Staging Orders, Checkout, Wallet & Coupons Controller (Firestore-backed)
 * Fully transactional inventory deduction, coupon validation, and wallet balance operations.
 */

const {
  createOrderTransactional,
  getOrderById: fetchOrderById,
  getUserOrders,
  getStoreOrders,
  updateOrderStatus,
  cancelOrderTransactional,
} = require('../../services/firestore/order.firestore.service');
const {
  validateCouponEligibility,
  getActiveCoupons,
  getCouponByCode,
} = require('../../services/firestore/coupon.firestore.service');
const {
  getWalletBalance,
  getWalletTransactions,
  creditWalletTransactional,
  debitWalletTransactional,
} = require('../../services/firestore/wallet.firestore.service');
const { emitOrderCreated, emitOrderStatusUpdate } = require('../../socket');

const orderCtrl = require('../order.controller');

// ─── Orders ─────────────────────────────────────────────────────────────────
const createOrder = async (req, res, next) => {
  return orderCtrl.createOrder(req, res, next);
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await fetchOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Ownership check: customer can only view own order unless admin/rider
    const userId = req.user._id || req.user.id;
    const userRole = req.user.role || 'customer';
    if (userRole === 'customer' && order.customer?.userId && order.customer.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this order' });
    }

    if (orderCtrl.ensureOrderDeliveryOtp) {
      await orderCtrl.ensureOrderDeliveryOtp(order);
    }
    const sanitized = orderCtrl.sanitizeOrderDates ? orderCtrl.sanitizeOrderDates(order) : order;
    return res.status(200).json({ success: true, order: sanitized });
  } catch (err) {
    next(err);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const orders = await getUserOrders(userId);
    if (orderCtrl.ensureOrderDeliveryOtp) {
      await Promise.all(orders.map((o) => orderCtrl.ensureOrderDeliveryOtp(o)));
    }
    const sanitizedOrders = orders.map((o) => (orderCtrl.sanitizeOrderDates ? orderCtrl.sanitizeOrderDates(o) : o));
    return res.status(200).json({
      success: true,
      count: sanitizedOrders.length,
      orders: sanitizedOrders,
    });
  } catch (err) {
    next(err);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const userRole = req.user ? (req.user.role || 'customer') : 'customer';
    const userPhone = req.user ? (req.user.phone || null) : null;
    const { reason } = req.body || {};

    const cancelled = await cancelOrderTransactional(
      req.params.orderId,
      reason || 'Customer requested cancellation',
      { id: userId, role: userRole, phone: userPhone }
    );

    try {
      const { emitOrderStatusUpdate } = require('../../socket');
      emitOrderStatusUpdate(req.params.orderId, { orderId: req.params.orderId, status: 'Cancelled' });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully and inventory restocked',
      order: cancelled,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Coupons ────────────────────────────────────────────────────────────────
const validateCoupon = async (req, res, next) => {
  try {
    const { code, amount } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const result = await validateCouponEligibility({
      couponCode: code,
      orderAmount: Number(amount) || 0,
      userId,
    });
    const discountAmount = result.discount ?? result.discountAmount ?? 0;
    const finalAmount = Math.max(0, (Number(amount) || 0) - discountAmount);
    return res.status(200).json({
      success: true,
      valid: result.isValid,
      coupon: result.coupon,
      discount: discountAmount,
      discountAmount,
      finalAmount,
      error: result.error,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listCoupons = async (req, res, next) => {
  try {
    const coupons = await getActiveCoupons();
    return res.status(200).json({
      success: true,
      count: coupons.length,
      coupons,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Wallet ─────────────────────────────────────────────────────────────────
const getWallet = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const walletBalance = await getWalletBalance(userId);
    const transactions = await getWalletTransactions(userId);
    return res.status(200).json({
      success: true,
      walletBalance,
      transactions,
    });
  } catch (err) {
    next(err);
  }
};

const creditWallet = async (req, res, next) => {
  try {
    const { amount, description, orderId } = req.body;
    const userId = req.user._id || req.user.id;
    const result = await creditWalletTransactional({
      userId,
      amount: Number(amount) || 0,
      description,
      orderId,
      actor: req.user,
    });
    return res.status(200).json({
      success: true,
      message: 'Wallet credited successfully',
      walletBalance: result.walletBalance,
      transaction: result.transaction,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const orderId = req.params.orderId;
    const actor = req.user;
    const updated = await updateOrderStatus(orderId, status, actor, note);
    try {
      const { emitOrderStatusUpdate } = require('../../socket');
      emitOrderStatusUpdate(orderId, { orderId, status });
    } catch (_) {}
    return res.status(200).json({ success: true, message: `Status updated to ${status}`, order: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const assignRider = async (req, res, next) => {
  try {
    const { riderId, riderName, riderPhone, vehicle } = req.body;
    const orderId = req.params.orderId;
    const { getDb } = require('../../lib/firestore');
    const db = getDb();
    const orderRef = db.collection('orders').doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const riderData = {
      id: riderId,
      name: riderName || 'Assigned Rider',
      phone: riderPhone || '',
      vehicle: vehicle || 'Bike',
      rating: '4.9',
      assignedAt: new Date().toISOString(),
    };
    await orderRef.update({
      rider: riderData,
      status: 'Ready',
      updatedAt: new Date().toISOString(),
    });
    try {
      const { emitOrderStatusUpdate } = require('../../socket');
      emitOrderStatusUpdate(orderId, { orderId, status: 'Ready', rider: riderData });
    } catch (_) {}
    return res.status(200).json({ success: true, message: 'Rider assigned to order', rider: riderData });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getOrdersForStore = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { status } = req.query;
    const orders = await getStoreOrders(storeId, status);
    return res.status(200).json({ success: true, count: orders.length, orders });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOrder,
  getOrderById,
  getMyOrders,
  cancelOrder,
  validateCoupon,
  listCoupons,
  getWallet,
  creditWallet,
  updateStatus,
  assignRider,
  getOrdersForStore,
};

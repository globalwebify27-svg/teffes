const {
  createDoc,
  getDoc,
  updateDoc,
  queryDocs,
  getDb,
} = require('../lib/firestore');
const {
  getUserById,
  updateUser,
} = require('../services/firestore/user.firestore.service');
const {
  getCouponByCode,
  calculateDiscount,
  isCouponExpired,
  isCouponFuture,
} = require('../services/firestore/coupon.firestore.service');
const {
  getStoreInventory,
  calculateInventoryStatus,
  normalizeItemName,
  matchCartItemToInventory,
  getItemRequiredAmount,
} = require('../services/firestore/inventory.firestore.service');
const {
  getUserOrders: getUserOrdersFS,
  getOrderById: getOrderByIdFS,
} = require('../services/firestore/order.firestore.service');
const notificationService = require('../services/notificationService');
const { emitOrderCreated } = require('../socket');
const { calculateTargetDeliveryTime, getEtaDetails } = require('../utils/etaCalculator');

const generateOrderId = () => {
  return 'TEF-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

/**
 * POST /api/orders
 * Create a new order (Pure Firestore Implementation)
 */
const createOrder = async (req, res, next) => {
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

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order items cannot be empty' });
    }

    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    let user = await getUserById(String(userId));
    if (!user) {
      user = {
        id: String(userId),
        _id: String(userId),
        name: req.user?.name || 'Valued Customer',
        phone: req.user?.phone || '9999999999',
        email: req.user?.email || '',
        role: req.user?.role || 'customer',
        walletBalance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      await createDoc('users', String(userId), user).catch(() => {});
    }

    // Resolve Doranda store aliases (S002 or S004) to canonical S004
    const rawStoreId = String(storeId || 'S001').trim();
    const resolvedStoreId = (rawStoreId === 'S002' || rawStoreId === 'S004') ? 'S004' : rawStoreId;
    const resolvedStoreName = (resolvedStoreId === 'S004') ? "TeFFe's — Doranda Hub" : (storeName || "TeFFe's Store");

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

    // ─── Authoritative Coupon Revalidation ───
    let verifiedDiscount = 0;
    let verifiedCouponSnapshot = null;
    const incomingCouponCode = (req.body.couponCode || req.body.coupon?.code || '').trim().toUpperCase();

    if (incomingCouponCode) {
      const couponDoc = await getCouponByCode(incomingCouponCode);
      if (!couponDoc || couponDoc.isActive === false || couponDoc.status === 'Paused') {
        return res.status(400).json({
          success: false,
          message: 'Coupon is no longer valid. Please try another coupon.',
        });
      }

      if (isCouponFuture(couponDoc.validFrom) || isCouponExpired(couponDoc.validTill) || couponDoc.status === 'Expired') {
        return res.status(400).json({
          success: false,
          message: 'Coupon has expired. Please try another coupon.',
        });
      }

      const minReq = couponDoc.minOrderAmount || couponDoc.minOrder || 0;
      if (itemsSubtotal < minReq) {
        return res.status(400).json({
          success: false,
          message: `Minimum order amount for this coupon is ₹${minReq}`,
        });
      }

      const usageLimit = Number(couponDoc.usageLimit);
      const usage = Number(couponDoc.usageCount || couponDoc.used || 0);
      if (usageLimit && usageLimit > 0 && usage >= usageLimit) {
        return res.status(400).json({
          success: false,
          message: 'Coupon usage limit has been reached.',
        });
      }

      verifiedDiscount = calculateDiscount(couponDoc, itemsSubtotal);
      verifiedCouponSnapshot = {
        code: couponDoc.code,
        discountType: couponDoc.discountType,
        discountValue: couponDoc.discountValue,
        discountAmount: verifiedDiscount,
      };

      // Increment coupon usage in Firestore
      await updateDoc('coupons', couponDoc.code, {
        usageCount: usage + 1,
        used: usage + 1,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    const isExpressSlot = !isPickup && Boolean(
      (deliverySlot && deliverySlot.toLowerCase().includes('60 min')) ||
      (deliverySlot && deliverySlot.toLowerCase().includes('express (60'))
    );
    const expressFee = isExpressSlot ? 50 : (Number(req.body.expressFee) || 0);
    const standardDeliveryFee = isPickup ? 0 : (itemsSubtotal >= 399 ? 0 : 40);
    const tipAmount = Number(req.body.tip) || 0;
    const computedFinalAmount = Math.max(0, itemsSubtotal + standardDeliveryFee + expressFee + tipAmount - verifiedDiscount);
    const finalAmount = amount !== undefined ? Number(amount) : (totalAmount !== undefined ? Number(totalAmount) : computedFinalAmount);

    let orderAddress = isPickup
      ? (shippingAddress || 'Store Pickup: Store Takeaway Counter, Ranchi')
      : (shippingAddress || 'Ranchi Delivery');

    if (!isPickup && addressId && Array.isArray(user.addresses)) {
      const addr = user.addresses.find((a) => String(a.id || a._id) === String(addressId));
      if (addr) {
        orderAddress = `${addr.line1 || ''}, ${addr.line2 ? addr.line2 + ', ' : ''}${addr.city || ''} - ${addr.pincode || ''}`.trim();
      }
    }

    const isOnline = paymentMethod?.toLowerCase().includes('online') || paymentMethod?.toLowerCase().includes('razorpay');

    // Dynamic initial ETA calculation
    const prepMinutes = Number(req.body.prepTimeMinutes) || 25;
    const initialTransit = isPickup ? 0 : 15;
    const targetDelivery = calculateTargetDeliveryTime(new Date(), prepMinutes, initialTransit);

    // ─── Deduct Store Inventory in Firestore (if mapped) ───
    try {
      const storeInv = await getStoreInventory(resolvedStoreId);
      if (Array.isArray(storeInv) && storeInv.length > 0) {
        for (const item of items) {
          const matched = matchCartItemToInventory(item, storeInv);
          if (matched && matched.id) {
            const reqKg = getItemRequiredAmount(item, matched.unit || 'kg');
            const currentStock = Number(matched.stock) || 0;
            const newStock = Math.max(0, Math.round((currentStock - reqKg) * 1000) / 1000);
            const newStatus = calculateInventoryStatus(newStock, matched.min);
            await updateDoc('inventory', matched.id, {
              stock: newStock,
              status: newStatus,
              updatedAt: new Date().toISOString(),
            }).catch(() => {});
          }
        }
      }
    } catch (invErr) {
      console.warn('[OrderController] Inventory deduction warning:', invErr.message);
    }

    // Wallet deduction if applicable
    const isWallet = paymentMethod === 'wallet' || paymentMethod === 'Wallet' || paymentMethod === 'Teffes Cash' || req.body.paymentMethod === 'wallet';
    if (isWallet) {
      const currentBal = Number(user.walletBalance) || 0;
      if (currentBal < finalAmount) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      }
      user.walletBalance = Math.round((currentBal - finalAmount) * 100) / 100;
      await updateDoc('users', user.id, {
        walletBalance: user.walletBalance,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    const orderId = req.body.orderId || generateOrderId();
    const now = new Date().toISOString();
    const itemSummary = items.map((i) => `${i.name || i.productId} ×${i.quantity || 1}`).join(', ');

    const orderPayload = {
      id: orderId,
      _id: orderId,
      orderId,
      customer: {
        name: user.name || req.body.customerName || 'Valued Customer',
        phone: user.phone || req.body.customerPhone || '9999999999',
        email: user.email || '',
        userId: user.id,
        address: orderAddress,
        lat: req.body.customerLat || 23.3512,
        lng: req.body.customerLng || 85.3154,
      },
      items: items.map((i) => ({
        productId: i.productId || i.id || '',
        name: i.name || 'Fresh Meat Cut',
        price: Number(i.price) || 0,
        quantity: Number(i.quantity) || 1,
        netWeight: i.netWeight || i.selectedWeight || i.weight || '500g',
        image: i.image || '',
      })),
      itemSummary,
      amount: finalAmount,
      totalAmount: finalAmount,
      itemsSubtotal,
      deliveryFee: standardDeliveryFee,
      expressFee,
      tipAmount,
      discountAmount: verifiedDiscount,
      couponCode: verifiedCouponSnapshot?.code || null,
      coupon: verifiedCouponSnapshot,
      storeId: resolvedStoreId,
      storeName: resolvedStoreName,
      deliverySlot: isPickup ? 'Store Pickup (Counter Takeaway)' : (deliverySlot || '90 Mins Express Delivery'),
      fulfillmentType: resolvedFulfillmentType,
      pickupMode: isPickup,
      prepTimeMinutes: prepMinutes,
      targetDeliveryTime: targetDelivery,
      remainingTransitMinutes: initialTransit,
      etaStage: 'PREPARING',
      paymentMethod: isWallet ? 'Teffes Cash (Wallet)' : (paymentMethod || (isPickup ? 'Pay at Store Counter' : 'Cash on Delivery')),
      paymentStatus: isWallet ? 'Paid' : (paymentStatus || (isOnline ? 'Paid' : 'Pending')),
      razorpayOrderId: razorpayOrderId || '',
      razorpayPaymentId: razorpayPaymentId || '',
      status: 'Pending',
      timeline: [{ status: 'Pending', timestamp: now, note: 'Order placed successfully' }],
      isInventoryDeducted: true,
      createdAt: now,
      updatedAt: now,
    };

    // Save order into Cloud Firestore orders collection
    await createDoc('orders', orderId, orderPayload, { overwrite: true });

    // Broadcast new order to store admin and socket clients immediately
    try {
      emitOrderCreated(orderPayload);
    } catch (sErr) {
      console.warn('[Socket.IO] emitOrderCreated warning:', sErr.message);
    }

    // Clear user cart upon successful order creation in Firestore
    await updateDoc('users', user.id, { cart: [], updatedAt: now }).catch(() => {});

    // Dispatch FCM push notification to customer
    try {
      notificationService.sendToUser(user.id, {
        title: 'Order Placed Successfully',
        body: `Your order #${orderPayload.orderId} for ₹${orderPayload.amount} has been received and sent to the store.`,
        data: {
          notificationType: 'ORDER_STATUS',
          orderId: orderPayload.orderId,
          status: 'Pending',
          clickAction: `/dashboard?orderId=${orderPayload.orderId}`,
        },
      }).catch(() => {});
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: orderPayload,
    });
  } catch (error) {
    next(error);
  }
};

const sanitizeOrderDates = (order) => {
  if (!order) return order;
  const o = { ...order };
  if (o.targetDeliveryTime && typeof o.targetDeliveryTime === 'object' && o.targetDeliveryTime._seconds !== undefined) {
    o.targetDeliveryTime = new Date(o.targetDeliveryTime._seconds * 1000).toISOString();
  }
  if (o.createdAt && typeof o.createdAt === 'object' && o.createdAt._seconds !== undefined) {
    o.createdAt = new Date(o.createdAt._seconds * 1000).toISOString();
  }
  if (o.updatedAt && typeof o.updatedAt === 'object' && o.updatedAt._seconds !== undefined) {
    o.updatedAt = new Date(o.updatedAt._seconds * 1000).toISOString();
  }
  return o;
};

/**
 * GET /api/orders
 * Get user's orders (Pure Firestore)
 */
const getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const orders = await getUserOrdersFS(String(userId));
    const enrichedOrders = orders.map((o) => {
      const obj = sanitizeOrderDates(o);
      obj.etaDetails = getEtaDetails(obj);
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
 * Get order by ID (Pure Firestore)
 */
const getOrderById = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    let order = await getOrderByIdFS(orderId);
    if (!order) {
      order = await getDoc('orders', orderId);
    }
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const orderObj = sanitizeOrderDates(order);
    orderObj.etaDetails = getEtaDetails(orderObj);

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
 * (Pure Firestore)
 */
const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const phone = req.user?.phone || '';
    const email = req.user?.email || '';

    // Query user orders from Firestore
    let orders = await getUserOrdersFS(String(userId));

    // Also match phone if not already found
    if (orders.length === 0 && phone) {
      const clean10 = phone.replace(/\D/g, '').slice(-10);
      const phoneOrders = await queryDocs('orders', (ref) => ref.where('customer.phone', '==', clean10));
      orders = phoneOrders;
    }

    const enrichedOrders = orders.map((o) => {
      const obj = sanitizeOrderDates(o);
      obj.etaDetails = getEtaDetails(obj);
      return obj;
    });

    res.status(200).json({ success: true, count: enrichedOrders.length, orders: enrichedOrders });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/:orderId/return
 * (Pure Firestore)
 */
const requestReturn = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    let order = await getDoc('orders', orderId);
    if (!order) {
      const orders = await queryDocs('orders', (ref) => ref.where('orderId', '==', orderId).limit(1));
      order = orders[0];
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const targetId = order.id || order.orderId;
    const now = new Date().toISOString();
    await updateDoc('orders', targetId, {
      returnStatus: 'Requested',
      returnReason: reason || 'Customer requested return',
      updatedAt: now,
    });

    const returnReqId = 'RET-' + Date.now().toString().slice(-5) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
    await createDoc('return_requests', returnReqId, {
      id: returnReqId,
      _id: returnReqId,
      requestId: returnReqId,
      orderId: order.orderId,
      customer: order.customer?.name || 'Customer',
      phone: order.customer?.phone || '',
      items: order.itemSummary || (order.items || []).map((i) => `${i.name} ×${i.quantity}`).join(', ') || 'Fresh cuts order',
      reason: reason || 'Customer requested return/exchange',
      condition: 'Reported within 60 mins guarantee',
      status: 'Pending Review',
      storeId: order.storeId || 'S001',
      createdAt: now,
      updatedAt: now,
    }).catch(() => {});

    order.returnStatus = 'Requested';
    order.returnReason = reason || 'Customer requested return';

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
 * (Pure Firestore)
 */
const verifyPayment = async (req, res, next) => {
  try {
    const { orderId, razorpayPaymentId, razorpayOrderId } = req.body;
    let order = await getDoc('orders', orderId);
    if (!order) {
      const orders = await queryDocs('orders', (ref) => ref.where('orderId', '==', orderId).limit(1));
      order = orders[0];
    }

    if (order) {
      const targetId = order.id || order.orderId;
      const updates = { paymentStatus: 'Paid', updatedAt: new Date().toISOString() };
      if (razorpayPaymentId) updates.razorpayPaymentId = razorpayPaymentId;
      if (razorpayOrderId) updates.razorpayOrderId = razorpayOrderId;
      await updateDoc('orders', targetId, updates);
      Object.assign(order, updates);
    }

    res.status(200).json({ success: true, message: 'Payment verified', order });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/:orderId/rate-rider
 * (Pure Firestore)
 */
const rateRider = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { rating, feedback } = req.body;

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars' });
    }

    let order = await getDoc('orders', orderId);
    if (!order) {
      const orders = await queryDocs('orders', (ref) => ref.where('orderId', '==', orderId).limit(1));
      order = orders[0];
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'You can only rate the rider after the order is delivered' });
    }

    const targetId = order.id || order.orderId;
    const now = new Date().toISOString();
    await updateDoc('orders', targetId, {
      riderRating: numRating,
      riderRatingFeedback: feedback || '',
      riderRatedAt: now,
      updatedAt: now,
    });

    order.riderRating = numRating;
    order.riderRatingFeedback = feedback || '';

    // Update rider's overall rating if riderId exists in Firestore
    if (order.rider?.riderId) {
      const riderUser = await getUserById(order.rider.riderId);
      if (riderUser) {
        const allRatedOrders = await queryDocs('orders', (ref) =>
          ref.where('rider.riderId', '==', order.rider.riderId).where('riderRating', '>=', 1)
        );
        const totalStars = allRatedOrders.reduce((sum, o) => sum + (Number(o.riderRating) || 0), 0) + numRating;
        const count = allRatedOrders.length + 1;
        const avg = parseFloat((totalStars / count).toFixed(1));

        await updateDoc('users', order.rider.riderId, {
          riderRating: avg,
          riderRatingCount: count,
          updatedAt: now,
        }).catch(() => {});
      }
    }

    res.status(200).json({
      success: true,
      message: 'Thank you! Your feedback for the delivery partner has been recorded.',
      order,
    });
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
  rateRider,
};

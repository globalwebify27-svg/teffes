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
const { validateCouponEligibility } = require('../utils/couponCalculator');
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
const {
  requestReturn: requestReturnFS,
} = require('../services/firestore/return.firestore.service');
const notificationService = require('../services/notificationService');
const { emitOrderCreated, emitOrderStatusUpdate, emitReturnCreated } = require('../socket');
const {
  calculateTargetDeliveryTime,
  getEtaDetails,
  isAfter8PM,
  getISTDateComponents,
  calculateNextDay9AM,
  getTodayISTDateString,
  isPastSpecialCloseTime,
} = require('../utils/etaCalculator');
const { getPaymentSettings } = require('../services/firestore/siteSettings.firestore.service');

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

    // Enforce minimum cart order amount of ₹200 for customer orders
    const initialItemsSubtotal = items.reduce(
      (sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)),
      0
    );
    const orderTotal = Number(amount ?? totalAmount ?? initialItemsSubtotal);
    if (initialItemsSubtotal < 200 && orderTotal < 200) {
      return res.status(400).json({
        success: false,
        message: 'Minimum order amount is ₹200. Please add more items to your cart to proceed.',
      });
    }

    // Re-verify that none of the items in the cart are marked Out of Stock in Firestore
    for (const item of items) {
      const pId = String(item.productId || item.id || '').trim();
      if (pId) {
        const prodDoc = await getDoc('products', pId);
        if (prodDoc && prodDoc.inStock === false) {
          return res.status(400).json({
            success: false,
            message: `"${prodDoc.name || item.name || 'This item'}" is currently out of stock. Please remove it from your cart before placing the order.`,
            outOfStockProductId: pId,
          });
        }
      }
    }

    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const isOnline = paymentMethod?.toLowerCase().includes('online') || paymentMethod?.toLowerCase().includes('payu') || paymentMethod?.toLowerCase().includes('razorpay');
    const isWallet = paymentMethod === 'wallet' || paymentMethod === 'Wallet' || paymentMethod === 'Teffes Cash' || req.body.paymentMethod === 'wallet';
    const isCod = !isOnline && !isWallet;

    // Enforce store payment settings
    const paymentSettings = await getPaymentSettings();
    if (isCod && paymentSettings.codEnabled === false) {
      return res.status(400).json({
        success: false,
        message: 'Cash on Delivery (COD) is currently disabled by store administration. Please choose another payment method.',
      });
    }
    if (isWallet && paymentSettings.walletEnabled === false) {
      return res.status(400).json({
        success: false,
        message: 'Wallet payment is currently disabled by store administration. Please choose another payment method.',
      });
    }
    if (isOnline && paymentSettings.onlineEnabled === false) {
      return res.status(400).json({
        success: false,
        message: 'Online payment is currently disabled by store administration. Please choose another payment method.',
      });
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

    // Guard: strictly block order creation if store is missing, paused, or offline
    const storeDoc = await getDoc('stores', resolvedStoreId);
    if (!storeDoc || storeDoc.isOpen === false || storeDoc.status === 'Inactive') {
      return res.status(400).json({
        success: false,
        message: storeDoc?.emergencyNotice || 'Our store is currently paused and not accepting new orders. Please check back shortly.',
      });
    }

    // Check special schedule for today
    const nowUtc = new Date();
    const todayIST = getTodayISTDateString(nowUtc);
    const todaySchedule = storeDoc?.specialSchedules?.[todayIST] || null;
    if (todaySchedule && todaySchedule.mode === 'closed') {
      return res.status(400).json({
        success: false,
        message: todaySchedule.customerNote || 'Our store is closed today for special operations. Please check back tomorrow.',
      });
    }

    // Calculate authoritative items subtotal directly from items
    const itemsSubtotal = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );

    // Determine whether order is Store Pickup or Home Delivery
    const isPickup = Boolean(
      pickupMode === true ||
      fulfillmentType === 'pickup' ||
      (typeof deliverySlot === 'string' && deliverySlot.toLowerCase().includes('pickup')) ||
      (typeof shippingAddress === 'string' && shippingAddress.toLowerCase().includes('store pickup'))
    );

    const resolvedFulfillmentType = isPickup ? 'pickup' : 'delivery';

    // ─── Authoritative Coupon Revalidation ───
    let verifiedDiscount = 0;
    let verifiedCouponSnapshot = null;
    const incomingCouponCode = (req.body.couponCode || req.body.coupon?.code || '').trim().toUpperCase();

    if (incomingCouponCode) {
      const couponDoc = await getCouponByCode(incomingCouponCode);
      if (!couponDoc) {
        return res.status(400).json({
          success: false,
          message: 'Coupon not found or is no longer valid.',
        });
      }

      const eligibility = await validateCouponEligibility(couponDoc, itemsSubtotal, user);
      if (!eligibility.isValid) {
        return res.status(400).json({
          success: false,
          message: eligibility.error,
        });
      }

      verifiedDiscount = eligibility.discount !== undefined ? eligibility.discount : calculateDiscount(couponDoc, itemsSubtotal);
      verifiedCouponSnapshot = {
        code: couponDoc.code,
        discountType: couponDoc.discountType,
        discountValue: couponDoc.discountValue,
        discountAmount: verifiedDiscount,
      };

      const usage = Number(couponDoc.usageCount || couponDoc.used || 0);
      // Increment coupon usage in Firestore
      await updateDoc('coupons', couponDoc.code, {
        usageCount: usage + 1,
        used: usage + 1,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    const isSpecialCutoffPassed = Boolean(
      todaySchedule &&
      (todaySchedule.mode === 'half_day' || todaySchedule.mode === 'custom_hours') &&
      todaySchedule.closeTime &&
      isPastSpecialCloseTime(todaySchedule.closeTime, nowUtc)
    );

    const nowComp = getISTDateComponents(nowUtc);
    const isNightAfter8PM = nowComp.hours >= 20 || (nowComp.hours === 19 && nowComp.minutes >= 59);
    const isEarlyMorningBefore8AM = nowComp.hours < 8;

    const isAfterHours = !isPickup && (
      isAfter8PM(nowUtc) ||
      isSpecialCutoffPassed ||
      (deliverySlot && (deliverySlot.toLowerCase().includes('tomorrow') || deliverySlot.toLowerCase().includes('next-day') || deliverySlot.toLowerCase().includes('9:00 am') || deliverySlot.toLowerCase().includes('today by 09:00 am')))
    );

    let resolvedDeliverySlot;
    if (isPickup) {
      resolvedDeliverySlot = 'Store Pickup (Counter Takeaway)';
    } else if (isSpecialCutoffPassed || (todaySchedule && todaySchedule.mode === 'closed')) {
      resolvedDeliverySlot = 'Next-Day Delivery: Tomorrow by 09:00 AM';
    } else if (isNightAfter8PM) {
      resolvedDeliverySlot = 'Next-Day Delivery: Tomorrow by 09:00 AM';
    } else if (isEarlyMorningBefore8AM) {
      resolvedDeliverySlot = 'Morning Delivery: Today by 09:00 AM';
    } else if (isAfterHours) {
      resolvedDeliverySlot = deliverySlot && deliverySlot.toLowerCase().includes('today')
        ? 'Morning Delivery: Today by 09:00 AM'
        : 'Next-Day Delivery: Tomorrow by 09:00 AM';
    } else {
      resolvedDeliverySlot = deliverySlot || '90 Mins Express Delivery';
    }

    const isExpressSlot = !isPickup && !isAfterHours && Boolean(
      (deliverySlot && deliverySlot.toLowerCase().includes('60 min')) ||
      (deliverySlot && deliverySlot.toLowerCase().includes('express (60'))
    );
    const freeThreshold = typeof storeDoc?.freeDeliveryThreshold === 'number' ? storeDoc.freeDeliveryThreshold : 399;
    const storeDeliveryFee = typeof storeDoc?.standardDeliveryFee === 'number' ? storeDoc.standardDeliveryFee : 40;
    const standardDeliveryFee = isPickup ? 0 : (itemsSubtotal >= freeThreshold ? 0 : storeDeliveryFee);
    const expressFee = isExpressSlot ? (typeof storeDoc?.expressDeliveryFee === 'number' ? storeDoc.expressDeliveryFee : 50) : (isAfterHours ? 0 : (Number(req.body.expressFee) || 0));
    const tipAmount = Number(req.body.tip) || 0;
    const computedFinalAmount = Math.max(0, itemsSubtotal + standardDeliveryFee + expressFee + tipAmount - verifiedDiscount);
    const finalAmount = amount !== undefined ? Number(amount) : (totalAmount !== undefined ? Number(totalAmount) : computedFinalAmount);

    let orderAddress = isPickup
      ? (shippingAddress || 'Store Pickup: Store Takeaway Counter, Ranchi')
      : (shippingAddress || 'Ranchi Delivery');

    if (!isPickup && addressId && Array.isArray(user.addresses)) {
      const addr = user.addresses.find((a) => String(a.id || a._id) === String(addressId));
      if (addr) {
        const street = (addr.line1 || addr.street || addr.address || addr.houseNo || addr.fullAddress || '').trim();
        const landmark = (addr.line2 || addr.landmark || '').trim();
        const city = (addr.city || 'Ranchi').trim();
        const pincode = (addr.pincode || '').trim();
        const parts = [
          street,
          landmark,
          city ? (pincode ? `${city} - ${pincode}` : city) : pincode,
        ].filter(Boolean);
        orderAddress = parts.join(', ');
      }
    }

    // Dynamic initial ETA calculation
    const prepMinutes = Number(req.body.prepTimeMinutes) || 25;
    const initialTransit = isPickup ? 0 : 15;
    const targetDeliveryDateObj = isAfterHours
      ? calculateNextDay9AM(nowUtc)
      : calculateTargetDeliveryTime(nowUtc, prepMinutes, initialTransit, resolvedDeliverySlot, todaySchedule);
    const targetDelivery = targetDeliveryDateObj.toISOString();

    // IST date string (YYYY-MM-DD) for date filtering in store admin
    const istMs = targetDeliveryDateObj.getTime() + (5.5 * 60 * 60 * 1000);
    const scheduledDeliveryDate = new Date(istMs).toISOString().slice(0, 10);

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
    const deliveryOtp = isPickup ? null : Math.floor(1000 + Math.random() * 9000).toString();

    const rawInstruction = req.body.deliveryInstruction || req.body.instruction || req.body.deliveryInstructions || req.body.deliveryNote || req.body.notes || '';
    const deliveryInstruction = typeof rawInstruction === 'string' ? rawInstruction.trim() : '';

    const orderPayload = {
      id: orderId,
      _id: orderId,
      orderId,
      deliveryOtp,
      deliveryInstruction: deliveryInstruction || null,
      customer: {
        name: user.name || req.body.customerName || 'Valued Customer',
        phone: user.phone || req.body.customerPhone || '9999999999',
        email: user.email || '',
        userId: user.id,
        address: orderAddress,
        deliveryInstruction: deliveryInstruction || null,
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
      isNextDayOrder: Boolean(isNightAfter8PM || isSpecialCutoffPassed || (todaySchedule && todaySchedule.mode === 'closed')),
      scheduledDeliveryDate,
      deliverySlot: resolvedDeliverySlot,
      fulfillmentType: resolvedFulfillmentType,
      pickupMode: Boolean(isPickup),
      prepTimeMinutes: prepMinutes,
      targetDeliveryTime: targetDelivery,
      remainingTransitMinutes: isAfterHours ? 0 : initialTransit,
      etaStage: isAfterHours ? (isEarlyMorningBefore8AM ? 'SCHEDULED_SAME_DAY' : 'SCHEDULED_NEXT_DAY') : 'PREPARING',
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
      message: 'Order created successfully',
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
 * Helper to ensure active delivery orders have a 4-digit confirmation OTP
 */
const ensureOrderDeliveryOtp = async (order) => {
  if (!order) return order;
  const isPickup = order.pickupMode === true || order.fulfillmentType === 'pickup' || order.isPickup === true;
  if (!order.deliveryOtp && !isPickup && order.status !== 'Delivered' && order.status !== 'Cancelled') {
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const docId = order.id || order._id || order.orderId;
    if (docId) {
      await updateDoc('orders', docId, {
        deliveryOtp: generatedOtp,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    order.deliveryOtp = generatedOtp;
  }
  return order;
};

/**
 * GET /api/orders
 * Get user's orders (Pure Firestore)
 */
const getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const orders = await getUserOrdersFS(String(userId));
    const enrichedOrders = await Promise.all(orders.map(async (o) => {
      await ensureOrderDeliveryOtp(o);
      const obj = sanitizeOrderDates(o);
      obj.etaDetails = getEtaDetails(obj);
      return obj;
    }));

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

    await ensureOrderDeliveryOtp(order);
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

    // Query user orders from Firestore by customer.userId
    let orders = await getUserOrdersFS(String(userId));

    // Also match by phone number to include phone/manual orders created by Store Admin
    if (phone) {
      const clean10 = phone.replace(/\D/g, '').slice(-10);
      if (clean10) {
        const phoneOrders = await queryDocs('orders', (ref) => ref.where('customer.phone', '==', clean10));
        const phoneOrdersFull = await queryDocs('orders', (ref) => ref.where('customer.phone', '==', `+91${clean10}`));
        const seen = new Set(orders.map((o) => o.orderId || o.id));
        for (const po of [...phoneOrders, ...phoneOrdersFull]) {
          const key = po.orderId || po.id;
          if (!seen.has(key)) {
            seen.add(key);
            orders.push(po);
          }
        }
      }
    }
    // Sort latest first
    orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const enrichedOrders = await Promise.all(orders.map(async (o) => {
      await ensureOrderDeliveryOtp(o);
      const obj = sanitizeOrderDates(o);
      obj.etaDetails = getEtaDetails(obj);
      return obj;
    }));

    res.status(200).json({ success: true, count: enrichedOrders.length, orders: enrichedOrders });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/orders/:orderId/return
 * Customer submits return / exchange request
 * (Pure Firestore - 60-min policy, 4-digit OTP, duplicate prevention)
 */
const requestReturn = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason, condition, items } = req.body;

    const returnDoc = await requestReturnFS({
      orderId,
      user: req.user,
      reason,
      condition,
      items,
    });

    const updatedOrder = await getDoc('orders', orderId);
    emitOrderStatusUpdate(orderId, updatedOrder || { orderId, returnStatus: 'Requested' });
    emitReturnCreated(returnDoc, updatedOrder || {});

    res.status(201).json({
      success: true,
      message: 'Return request submitted successfully under 60-minute policy',
      returnRequest: returnDoc,
      requestId: returnDoc.requestId,
      order: updatedOrder,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to submit return request',
    });
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
        // Query by single field to avoid composite index requirement
        const allRiderOrders = await queryDocs('orders', (ref) =>
          ref.where('rider.riderId', '==', order.rider.riderId)
        );
        const allRatedOrders = allRiderOrders.filter((o) => typeof o.riderRating === 'number' && o.riderRating >= 1);
        const hasCurrentOrder = allRatedOrders.some((o) => (o.id || o.orderId) === targetId);
        const totalStars = allRatedOrders.reduce((sum, o) => sum + (Number(o.riderRating) || 0), 0) + (hasCurrentOrder ? 0 : numRating);
        const count = allRatedOrders.length + (hasCurrentOrder ? 0 : 1);
        const avg = parseFloat((totalStars / Math.max(1, count)).toFixed(1));

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
  sanitizeOrderDates,
  ensureOrderDeliveryOtp,
};

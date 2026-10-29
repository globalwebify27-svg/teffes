const {
  getDb,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  runTransaction,
} = require('../../lib/firestore');
const { calculateInventoryStatus, getInventoryDocId } = require('./inventory.firestore.service');
const { calculateDiscount, isCouponExpired, isCouponFuture } = require('./coupon.firestore.service');

const ORDERS_COLLECTION = 'orders';
const USERS_COLLECTION = 'users';
const INVENTORY_COLLECTION = 'inventory';
const HISTORY_COLLECTION = 'inventory_history';
const COUPONS_COLLECTION = 'coupons';
const TRANSACTIONS_COLLECTION = 'wallet_transactions';

const ORDER_STATUS_ENUM = ['Pending', 'Cutting', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'];

/**
 * Generate unique order ID with TEF prefix.
 */
const generateOrderId = () => {
  return 'TEF-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

/**
 * Retrieve order by orderId.
 */
const getOrderById = async (orderId) => {
  if (!orderId || typeof orderId !== 'string') return null;
  const cleanId = orderId.trim();
  let order = await getDoc(ORDERS_COLLECTION, cleanId);
  if (!order) {
    const list = await queryDocs(ORDERS_COLLECTION, (ref) => ref.where('orderId', '==', cleanId).limit(1));
    if (list && list.length > 0) {
      order = list[0];
    }
  }
  return order;
};
 
const isTestOrderRecord = (o) =>
  o.isTest === true ||
  String(o.orderId || '').startsWith('TEST_') ||
  String(o.orderId || '').startsWith('ORD_CONCURRENCY') ||
  String(o.orderId || '').startsWith('ORD_IDEMP_');

/**
 * Retrieve orders for a specific user.
 */
const getUserOrders = async (userId, options = {}) => {
  if (!userId || typeof userId !== 'string') return [];
  const cleanId = userId.trim();
  let orders = await queryDocs(ORDERS_COLLECTION, (ref) =>
    ref.where('customer.userId', '==', cleanId)
  );
  if (!options.includeTest) {
    orders = orders.filter((o) => !isTestOrderRecord(o));
  }
  return orders.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Retrieve orders for a store with optional status filter.
 */
const getStoreOrders = async (storeId, status = null, options = {}) => {
  if (!storeId || typeof storeId !== 'string') return [];
  const cleanId = storeId.trim();
  const targetStoreIds = (cleanId === 'S002' || cleanId === 'S004') ? ['S004', 'S002'] : [cleanId];
  let allOrders = [];
  for (const sId of targetStoreIds) {
    const docs = await queryDocs(ORDERS_COLLECTION, (ref) =>
      ref.where('storeId', '==', sId)
    );
    allOrders.push(...docs);
  }
  const seen = new Set();
  let orders = allOrders.filter((o) => {
    const key = o.orderId || o.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!options.includeTest) {
    orders = orders.filter((o) => !isTestOrderRecord(o));
  }
  if (status && status !== 'all') {
    orders = orders.filter((o) => o.status === status);
  }
  return orders.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Authoritative checkout and atomic order placement transaction.
 *
 * Full ACID Guarantees:
 * 1. Idempotency protection: returns existing order if idempotencyKey or orderId matches.
 * 2. Re-computes authoritative subtotal on the server.
 * 3. Atomic stock verification and inventory deduction.
 * 4. Atomic coupon validation and usageCount increment.
 * 5. Atomic wallet debit if payment method is wallet.
 * 6. Point-in-time product snapshot embedded in order document.
 * 7. Clears user cart.
 */
const createOrderTransactional = async (orderData = {}) => {
  const {
    orderId = generateOrderId(),
    idempotencyKey = null,
    customer,
    items,
    storeId = 'S001',
    storeName = 'Central Store',
    deliverySlot = '90 Mins Express Delivery',
    fulfillmentType = 'delivery',
    pickupMode = false,
    shippingAddress,
    couponCode = null,
    tip = 0,
    paymentMethod = 'Cash on Delivery',
  } = orderData;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Order items cannot be empty');
  }
  if (!customer || !customer.userId || !customer.phone) {
    throw new Error('Valid customer information (userId, phone) is required');
  }

  const db = getDb();
  const now = new Date().toISOString();
  const cleanUserId = String(customer.userId).trim();
  const rawStoreId = String(storeId).trim();
  const cleanStoreId = (rawStoreId === 'S002' || rawStoreId === 'S004') ? 'S004' : rawStoreId;
  const resolvedStoreName = (rawStoreId === 'S002' || rawStoreId === 'S004') ? "TeFFe's — Doranda Hub" : storeName;
  const cleanOrderId = String(orderId).trim();

  // 1. Check idempotency outside transaction to avoid unnecessary locks
  if (idempotencyKey) {
    const existingByIdempotency = await queryDocs(ORDERS_COLLECTION, (ref) =>
      ref.where('idempotencyKey', '==', idempotencyKey).limit(1)
    );
    if (existingByIdempotency.length > 0) {
      return { success: true, isDuplicate: true, order: existingByIdempotency[0] };
    }
  }

  const existingOrder = await getDoc(ORDERS_COLLECTION, cleanOrderId);
  if (existingOrder) {
    return { success: true, isDuplicate: true, order: existingOrder };
  }

  // Calculate authoritative items subtotal
  const itemsSubtotal = items.reduce((sum, item) => {
    const price = Math.max(0, Number(item.price) || 0);
    const qty = Math.max(1, Number(item.quantity) || 1);
    return sum + price * qty;
  }, 0);

  const isPickup = pickupMode === true || fulfillmentType === 'pickup';
  const resolvedFulfillment = isPickup ? 'pickup' : 'delivery';
  const standardDeliveryFee = isPickup ? 0 : itemsSubtotal >= 399 ? 0 : 40;
  const isExpress = !isPickup && String(deliverySlot).toLowerCase().includes('express');
  const expressFee = isExpress ? 50 : 0;
  const tipAmount = Math.max(0, Number(tip) || 0);

  return runTransaction(async (transaction) => {
    // ── Phase A: Reads ────────────────────────────────────────────────────────

    // 0. Atomic In-Transaction Idempotency Guard: Prevents concurrent race conditions & duplicate deductions
    const orderRef = db.collection(ORDERS_COLLECTION).doc(cleanOrderId);
    const orderSnap = await transaction.get(orderRef);
    if (orderSnap.exists) {
      return {
        success: true,
        isDuplicate: true,
        order: orderSnap.data(),
      };
    }

    let idempRef = null;
    if (idempotencyKey) {
      const cleanIdempKey = String(idempotencyKey).trim();
      idempRef = db.collection('idempotency_keys').doc(cleanIdempKey);
      const idempSnap = await transaction.get(idempRef);
      if (idempSnap.exists) {
        const existingOrderId = idempSnap.data().orderId;
        const existingOrdRef = db.collection(ORDERS_COLLECTION).doc(existingOrderId);
        const existingOrdSnap = await transaction.get(existingOrdRef);
        if (existingOrdSnap.exists) {
          return {
            success: true,
            isDuplicate: true,
            order: existingOrdSnap.data(),
          };
        }
      }
    }

    // 1. Read Customer User document
    const userRef = db.collection(USERS_COLLECTION).doc(cleanUserId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new Error(`Customer profile "${cleanUserId}" not found`);
    }
    const userData = userSnap.data();
    if (userData.isActive === false) {
      throw new Error('Customer account is deactivated');
    }

    // 2. Read Coupon document (if code supplied)
    let couponSnap = null;
    let couponRef = null;
    const cleanCouponCode = couponCode ? couponCode.trim().toUpperCase() : null;

    if (cleanCouponCode) {
      couponRef = db.collection(COUPONS_COLLECTION).doc(cleanCouponCode);
      couponSnap = await transaction.get(couponRef);
      if (!couponSnap.exists) {
        throw new Error(`Coupon "${cleanCouponCode}" is invalid`);
      }
    }

    // 3. Read Inventory documents for all ordered items
    const inventoryReads = [];
    for (const item of items) {
      const pId = item.productId || item.itemId || item.id;
      const invDocId = getInventoryDocId(cleanStoreId, pId);
      const invRef = db.collection(INVENTORY_COLLECTION).doc(invDocId);
      inventoryReads.push({ item, invRef, invDocId });
    }

    const inventorySnaps = [];
    for (const r of inventoryReads) {
      const snap = await transaction.get(r.invRef);
      if (!snap.exists) {
        throw new Error(`Item "${r.item.name || r.item.id}" is not available in store "${cleanStoreId}" inventory`);
      }
      inventorySnaps.push({ ...r, data: snap.data(), snap });
    }

    // ── Phase B: Business Rule Validations ────────────────────────────────────

    // Validate Coupon
    let verifiedDiscount = 0;
    let verifiedCouponSnapshot = null;

    if (couponSnap && couponSnap.exists) {
      const cData = couponSnap.data();
      if (cData.isActive === false || cData.status === 'Paused') {
        throw new Error('Coupon is currently inactive');
      }
      if (isCouponFuture(cData.validFrom)) {
        throw new Error('Coupon is not active yet');
      }
      if (isCouponExpired(cData.validTill) || cData.status === 'Expired') {
        throw new Error('Coupon has expired');
      }
      const minReq = cData.minOrderAmount || cData.minOrder || 0;
      if (itemsSubtotal < minReq) {
        throw new Error(`Minimum order amount for this coupon is ₹${minReq}`);
      }
      const limit = Number(cData.usageLimit);
      const usage = Number(cData.usageCount || cData.used || 0);
      if (limit && limit > 0 && usage >= limit) {
        throw new Error('Coupon usage limit has been reached');
      }

      verifiedDiscount = calculateDiscount(cData, itemsSubtotal);
      verifiedCouponSnapshot = {
        code: cData.code,
        discountType: cData.discountType,
        discountValue: cData.discountValue,
        discountAmount: verifiedDiscount,
      };
    }

    // Calculate final payable amount
    const computedFinalAmount = Math.max(
      0,
      itemsSubtotal + standardDeliveryFee + expressFee + tipAmount - verifiedDiscount
    );

    // Validate Stock Availability
    for (const entry of inventorySnaps) {
      const reqQty = Math.max(1, Number(entry.item.quantity) || 1);
      const currentStock = Number(entry.data.stock) || 0;
      if (currentStock < reqQty) {
        throw new Error(
          `Insufficient stock for "${entry.data.item}". Requested: ${reqQty} ${entry.data.unit}, Available: ${currentStock} ${entry.data.unit}`
        );
      }
    }

    // Validate Wallet Balance (if payment method is wallet)
    const cleanMethod = (paymentMethod || '').toLowerCase();
    const isWalletPayment =
      cleanMethod === 'wallet' ||
      cleanMethod.includes('teffes cash') ||
      cleanMethod.includes('(wallet)');

    if (isWalletPayment) {
      const walletBal = Number(userData.walletBalance) || 0;
      if (walletBal < computedFinalAmount) {
        throw new Error(`Insufficient wallet balance. Available: ₹${walletBal}, Required: ₹${computedFinalAmount}`);
      }
    }

    // ── Phase C: Atomic Mutations ─────────────────────────────────────────────

    // 1. Decrement Inventory & Append Audit Log
    for (const entry of inventorySnaps) {
      const reqQty = Math.max(1, Number(entry.item.quantity) || 1);
      const currentStock = Number(entry.data.stock) || 0;
      const newStock = Math.round((currentStock - reqQty) * 1000) / 1000;
      const newStatus = calculateInventoryStatus(newStock, entry.data.min);

      transaction.update(entry.invRef, {
        stock: newStock,
        status: newStatus,
        updatedAt: now,
      });

      const histRef = db.collection(HISTORY_COLLECTION).doc();
      transaction.set(histRef, {
        id: histRef.id,
        _id: histRef.id,
        storeId: cleanStoreId,
        itemId: entry.data.itemId,
        productName: entry.data.item,
        category: entry.data.category || '',
        classification: 'fresh',
        actionType: 'order_deduction',
        quantity: reqQty,
        unit: entry.data.unit || 'kg',
        previousQuantity: currentStock,
        resultingQuantity: newStock,
        sourceClassification: 'fresh',
        destinationClassification: null,
        reason: `Order #${cleanOrderId}`,
        orderId: cleanOrderId,
        actor: {
          userId: cleanUserId,
          name: customer.name || userData.name || 'Customer',
          role: 'customer',
        },
        createdAt: now,
      });
    }

    // 2. Increment Coupon usageCount (if coupon applied)
    if (couponRef && couponSnap) {
      const currentUsage = Number(couponSnap.data().usageCount || couponSnap.data().used || 0);
      transaction.update(couponRef, {
        usageCount: currentUsage + 1,
        used: currentUsage + 1,
        updatedAt: now,
      });
    }

    // 3. Debit User Wallet & Log Transaction (if wallet payment)
    if (isWalletPayment) {
      const currentBal = Number(userData.walletBalance) || 0;
      const newBal = Math.round((currentBal - computedFinalAmount) * 100) / 100;

      transaction.update(userRef, {
        walletBalance: newBal,
        cart: [], // Clear cart atomically
        updatedAt: now,
      });

      const txnRef = db.collection(TRANSACTIONS_COLLECTION).doc();
      transaction.set(txnRef, {
        id: txnRef.id,
        _id: txnRef.id,
        userId: cleanUserId,
        type: 'Debit',
        amount: computedFinalAmount,
        balanceAfter: newBal,
        description: `Order payment for ${cleanOrderId}`,
        orderId: cleanOrderId,
        status: 'Success',
        createdAt: now,
      });
    } else {
      // Clear cart on user profile
      transaction.update(userRef, {
        cart: [],
        updatedAt: now,
      });
    }

    // 4. Create Order Document with embedded snapshots
    const itemSummary = items.map((i) => `${i.name || i.productId} ×${i.quantity || 1}`).join(', ');

    const orderPayload = {
      id: cleanOrderId,
      _id: cleanOrderId,
      orderId: cleanOrderId,
      idempotencyKey: idempotencyKey || null,
      customer: {
        userId: cleanUserId,
        name: customer.name || userData.name || 'Valued Customer',
        phone: customer.phone || userData.phone || '9999999999',
        email: customer.email || userData.email || '',
        address: shippingAddress || (isPickup ? 'Store Takeaway Counter' : 'Home Delivery'),
        lat: customer.lat || 23.3512,
        lng: customer.lng || 85.3154,
      },
      items: items.map((i) => ({
        productId: i.productId || i.itemId || i.id,
        name: i.name || 'Fresh Item',
        price: Number(i.price) || 0,
        quantity: Number(i.quantity) || 1,
        netWeight: i.netWeight || '500g',
        image: i.image || '',
      })),
      itemSummary,
      amount: computedFinalAmount,
      totalAmount: computedFinalAmount,
      itemsSubtotal,
      deliveryFee: standardDeliveryFee,
      expressFee,
      tipAmount,
      discountAmount: verifiedDiscount,
      couponCode: cleanCouponCode,
      coupon: verifiedCouponSnapshot,
      storeId: cleanStoreId,
      storeName: resolvedStoreName,
      deliverySlot: isPickup ? 'Store Pickup' : deliverySlot,
      fulfillmentType: resolvedFulfillment,
      pickupMode: isPickup,
      paymentMethod: isWalletPayment ? 'Teffes Cash (Wallet)' : paymentMethod,
      paymentStatus: isWalletPayment ? 'Paid' : 'Pending',
      status: 'Pending',
      timeline: [{ status: 'Pending', timestamp: now, note: 'Order placed successfully' }],
      isInventoryDeducted: true,
      isInventoryRestocked: false,
      createdAt: now,
      updatedAt: now,
    };

    if (idempRef) {
      transaction.set(idempRef, {
        orderId: cleanOrderId,
        idempotencyKey: String(idempotencyKey).trim(),
        createdAt: now,
      });
    }

    transaction.set(orderRef, orderPayload);

    return {
      success: true,
      isDuplicate: false,
      order: orderPayload,
    };
  });
};

/**
 * Update order status and append to chronological status timeline.
 */
const updateOrderStatus = async (orderId, newStatus, actor = null, note = '') => {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('orderId is required');
  }
  if (!ORDER_STATUS_ENUM.includes(newStatus)) {
    throw new Error(`Invalid order status: ${newStatus}`);
  }

  const cleanOrderId = orderId.trim();
  const order = await getDoc(ORDERS_COLLECTION, cleanOrderId);
  if (!order) {
    throw new Error(`Order "${cleanOrderId}" not found`);
  }

  const now = new Date().toISOString();
  const timeline = Array.isArray(order.timeline) ? [...order.timeline] : [];
  timeline.push({
    status: newStatus,
    timestamp: now,
    note: note || `Status updated to ${newStatus}`,
    actor: actor ? { id: actor.id || null, role: actor.role || 'system' } : { role: 'system' },
  });

  const updates = {
    status: newStatus,
    timeline,
    updatedAt: now,
  };

  if (newStatus === 'Out for Delivery') {
    updates.pickedUpAt = now;
  } else if (newStatus === 'Delivered') {
    updates.deliveredAt = now;
    updates.paymentStatus = 'Paid';
  }

  return updateDoc(ORDERS_COLLECTION, cleanOrderId, updates);
};

/**
 * Atomically cancel an order, restore stock, and process refund if paid via wallet.
 */
/**
 * Atomically cancel an order, restore stock, and process refund if paid via wallet.
 */
const cancelOrderTransactional = async (orderId, reason = 'Order cancelled', actor = null) => {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('orderId is required');
  }

  const cleanOrderId = orderId.trim();
  const db = getDb();
  const now = new Date().toISOString();

  // Normalize actor information
  let cleanActor = { role: 'system' };
  if (actor) {
    if (typeof actor === 'object') {
      cleanActor = {
        id: actor.id || actor._id || actor.userId || null,
        role: actor.role || 'customer',
        phone: actor.phone || null,
      };
    } else if (typeof actor === 'string') {
      cleanActor = {
        id: actor,
        role: 'customer',
      };
    }
  }

  // 1. Resolve order doc by ID or orderId or id
  let targetDocId = cleanOrderId;
  let targetDocRef = db.collection(ORDERS_COLLECTION).doc(cleanOrderId);
  let initialSnap = await targetDocRef.get();

  if (!initialSnap.exists) {
    // Try query by orderId
    const q1 = await db.collection(ORDERS_COLLECTION).where('orderId', '==', cleanOrderId).limit(1).get();
    if (!q1.empty) {
      targetDocId = q1.docs[0].id;
      initialSnap = q1.docs[0];
    } else {
      // Try query by id
      const q2 = await db.collection(ORDERS_COLLECTION).where('id', '==', cleanOrderId).limit(1).get();
      if (!q2.empty) {
        targetDocId = q2.docs[0].id;
        initialSnap = q2.docs[0];
      } else {
        // Try with TEF- prefix or without TEF- prefix
        const altId = cleanOrderId.startsWith('TEF-') ? cleanOrderId.replace(/^TEF-/, '') : `TEF-${cleanOrderId}`;
        const q3 = await db.collection(ORDERS_COLLECTION).where('orderId', '==', altId).limit(1).get();
        if (!q3.empty) {
          targetDocId = q3.docs[0].id;
          initialSnap = q3.docs[0];
        }
      }
    }
  }

  if (!initialSnap.exists) {
    throw new Error(`Order "${cleanOrderId}" not found`);
  }

  return runTransaction(async (transaction) => {
    const orderRef = db.collection(ORDERS_COLLECTION).doc(targetDocId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new Error(`Order "${cleanOrderId}" not found`);
    }

    const orderData = orderSnap.data();
    if (orderData.status === 'Cancelled') {
      throw new Error('Order is already cancelled');
    }
    if (orderData.status === 'Delivered') {
      throw new Error('Delivered orders cannot be cancelled');
    }
    if (orderData.status === 'Out for Delivery' && cleanActor.role === 'customer') {
      throw new Error('Order is already out for delivery and cannot be cancelled');
    }

    // Customer authorization check
    if (cleanActor.role === 'customer' && cleanActor.id) {
      const orderCustomerUserId = orderData.customer?.userId || orderData.customer?.id || orderData.userId;
      if (orderCustomerUserId && String(orderCustomerUserId) !== String(cleanActor.id)) {
        const actorPhone = cleanActor.phone;
        const orderPhone = orderData.customer?.phone;
        if (!actorPhone || !orderPhone || actorPhone !== orderPhone) {
          throw new Error('You are not authorized to cancel this order');
        }
      }
    }

    // ── PHASE A: ALL READS FIRST (Firestore Transaction Rule) ──
    const inventoryReads = [];
    if (orderData.isInventoryDeducted && !orderData.isInventoryRestocked && orderData.storeId) {
      const itemsByInvDoc = new Map();
      for (const item of orderData.items || []) {
        const prodId = item.productId || item.itemId || item.id || item._id;
        if (!prodId) continue;
        const invDocId = getInventoryDocId(orderData.storeId, prodId);
        const qty = Math.max(1, Number(item.quantity) || 1);
        if (itemsByInvDoc.has(invDocId)) {
          const existing = itemsByInvDoc.get(invDocId);
          existing.quantity += qty;
        } else {
          itemsByInvDoc.set(invDocId, {
            invDocId,
            item,
            productId: prodId,
            quantity: qty,
            invRef: db.collection(INVENTORY_COLLECTION).doc(invDocId),
          });
        }
      }
      inventoryReads.push(...itemsByInvDoc.values());
    }

    const inventorySnaps = [];
    for (const r of inventoryReads) {
      const snap = await transaction.get(r.invRef);
      if (snap.exists) {
        inventorySnaps.push({ ...r, snap, data: snap.data() });
      }
    }

    let userSnap = null;
    let userRef = null;
    const isWallet = orderData.paymentMethod?.toLowerCase().includes('wallet') && Number(orderData.amount) > 0;
    if (isWallet && orderData.customer?.userId) {
      userRef = db.collection(USERS_COLLECTION).doc(orderData.customer.userId);
      userSnap = await transaction.get(userRef);
    }

    // ── PHASE B: ALL WRITES AFTER READS ──
    // 1. Restore Inventory Stock
    for (const entry of inventorySnaps) {
      const reqQty = entry.quantity;
      const currentStock = Number(entry.data.stock) || 0;
      const restoredStock = Math.round((currentStock + reqQty) * 1000) / 1000;
      const newStatus = calculateInventoryStatus(restoredStock, entry.data.min);

      transaction.update(entry.invRef, {
        stock: restoredStock,
        status: newStatus,
        updatedAt: now,
      });

      const histRef = db.collection(HISTORY_COLLECTION).doc();
      transaction.set(histRef, {
        id: histRef.id,
        _id: histRef.id,
        storeId: orderData.storeId,
        itemId: entry.productId,
        productName: entry.item?.name || 'Restocked item',
        classification: 'fresh',
        actionType: 'order_restock',
        quantity: reqQty,
        unit: entry.data.unit || 'kg',
        previousQuantity: currentStock,
        resultingQuantity: restoredStock,
        reason: `Restocked — Order #${orderData.orderId || cleanOrderId} cancelled`,
        orderId: orderData.orderId || cleanOrderId,
        createdAt: now,
      });
    }

    // 2. Refund wallet if paid via wallet
    if (userSnap && userSnap.exists) {
      const currentBal = Number(userSnap.data().walletBalance) || 0;
      const refundAmount = Number(orderData.amount);
      const newBal = Math.round((currentBal + refundAmount) * 100) / 100;

      transaction.update(userRef, {
        walletBalance: newBal,
        updatedAt: now,
      });

      const txnRef = db.collection(TRANSACTIONS_COLLECTION).doc();
      transaction.set(txnRef, {
        id: txnRef.id,
        _id: txnRef.id,
        userId: orderData.customer.userId,
        type: 'Credit',
        amount: refundAmount,
        balanceAfter: newBal,
        description: `Refund for cancelled order #${orderData.orderId || cleanOrderId}`,
        orderId: orderData.orderId || cleanOrderId,
        status: 'Success',
        createdAt: now,
      });
    }

    // 3. Mark order Cancelled
    const timeline = Array.isArray(orderData.timeline) ? [...orderData.timeline] : [];
    timeline.push({
      status: 'Cancelled',
      timestamp: now,
      note: reason,
      actor: cleanActor,
    });

    transaction.update(orderRef, {
      status: 'Cancelled',
      isInventoryRestocked: true,
      cancellationReason: reason,
      timeline,
      updatedAt: now,
    });

    return {
      success: true,
      message: 'Order cancelled, inventory restored, and wallet refunded if applicable',
      orderId: orderData.orderId || cleanOrderId,
    };
  });
};

/**
 * Retrieve all orders.
 */
const getAllOrders = async (options = {}) => {
  let orders = await queryDocs(ORDERS_COLLECTION);
  if (!options.includeTest) {
    orders = orders.filter((o) => !isTestOrderRecord(o));
  }
  return orders.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Safely delete an order (strictly for test cleanup).
 */
const deleteOrder = async (orderId) => {
  if (!orderId || typeof orderId !== 'string') return false;
  await deleteDoc(ORDERS_COLLECTION, orderId.trim());
  return true;
};

module.exports = {
  ORDERS_COLLECTION,
  ORDER_STATUS_ENUM,
  generateOrderId,
  getOrderById,
  getAllOrders,
  getUserOrders,
  getStoreOrders,
  createOrderTransactional,
  updateOrderStatus,
  cancelOrderTransactional,
  deleteOrder,
};

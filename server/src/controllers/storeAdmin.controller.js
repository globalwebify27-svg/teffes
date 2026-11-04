/**
 * Store Admin Controller (Pure Cloud Firestore Backend)
 * 100% Zero MongoDB dependency - Fully migrated to Google Cloud Firestore
 */

const {
  getDb,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
} = require('../lib/firestore');

const {
  getStoreOrders,
  getOrderById: getOrderByIdFS,
  updateOrderStatus: updateOrderStatusFS,
} = require('../services/firestore/order.firestore.service');

const {
  getStoreInventory,
  getInventoryItem,
  updateInventoryItem: updateInventoryItemFS,
  getInventoryHistory: getInventoryHistoryFS,
  transferDefreezeToFreshTransactional,
  recordDamageWasteTransactional,
} = require('../services/firestore/inventory.firestore.service');

const {
  getStoreDeliverySlots,
} = require('../services/firestore/deliverySlot.firestore.service');

const {
  getStoreReturnRequests,
  updateReturnStatus: updateReturnStatusFS,
  assignRiderToReturn: assignRiderToReturnFS,
  verifyReturnOtpAndComplete: verifyReturnOtpAndCompleteFS,
} = require('../services/firestore/return.firestore.service');

const {
  getStoreById,
  updateStore: updateStoreFS,
  createStore: createStoreFS,
} = require('../services/firestore/store.firestore.service');

const {
  getStoreRemittances: getStoreRemittancesFS,
  confirmRemittanceTransactional,
  calculateRiderCashInHand,
  submitRemittance,
} = require('../services/firestore/remittance.firestore.service');

const notificationService = require('../services/notificationService');
const { emitOrderStatusUpdate, emitInventoryUpdate } = require('../socket');

const {
  getStoreBatchConfig,
  updateStoreBatchConfig,
  evaluateRouteFeasibility,
  createDeliveryBatchTransactional,
} = require('../services/firestore/batch.firestore.service');

/**
 * Normalizes store ID (maps S002 ↔ S004 for Doranda hub)
 */
const resolveStoreId = (rawStoreId) => {
  if (!rawStoreId) return 'S001';
  const clean = String(rawStoreId).trim();
  return (clean === 'S002' || clean === 'S004') ? 'S004' : clean;
};

const getEffectiveStoreId = (req) => {
  const chosen = req.query?.storeId || req.body?.storeId || req.user?.storeId || 'S001';
  return resolveStoreId(chosen);
};

/**
 * GET /api/store-admin/dashboard
 * Store Admin KPI summary & latest orders
 */
const getDashboardOverview = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);

    const [orders, inventory, allRiders] = await Promise.all([
      getStoreOrders(storeId),
      getStoreInventory(storeId),
      queryDocs('users', (ref) => ref.where('role', '==', 'rider')),
    ]);

    const pendingCount = orders.filter((o) => ['Pending', 'Cutting'].includes(o.status)).length;
    const deliveredOrders = orders.filter((o) => o.status === 'Delivered');
    const deliveredTodayCount = deliveredOrders.length;
    const totalOrders = orders.length;

    const chickenInv = inventory.find((i) => (i.category || '').toLowerCase() === 'chicken' || (i.item || '').toLowerCase().includes('chicken'));
    const muttonInv = inventory.find((i) => (i.category || '').toLowerCase() === 'mutton' || (i.item || '').toLowerCase().includes('mutton'));

    const activeRidersCount = allRiders.filter((r) => r.isActive !== false && (!r.storeId || resolveStoreId(r.storeId) === storeId)).length || allRiders.length;

    const kpis = [
      {
        icon: 'pending_actions',
        label: 'Orders to Prepare',
        value: `${pendingCount}`,
        sub: pendingCount > 0 ? `${pendingCount} orders in butcher prep` : 'All caught up',
        color: '#941717',
        tab: 'orders',
      },
      {
        icon: 'check_circle',
        label: 'Delivered Today',
        value: `${deliveredTodayCount}`,
        sub: `Out of ${totalOrders} total orders`,
        color: '#059669',
        tab: 'orders',
      },
      {
        icon: 'set_meal',
        label: 'Chicken Stock',
        value: chickenInv ? `${chickenInv.stock} ${chickenInv.unit || 'kg'}` : 'In Stock',
        sub: 'Fresh batch available',
        color: '#7c3aed',
        tab: 'inventory',
      },
      {
        icon: 'kebab_dining',
        label: 'Mutton Stock',
        value: muttonInv ? `${muttonInv.stock} ${muttonInv.unit || 'kg'}` : 'In Stock',
        sub: 'Young goat fresh batch',
        color: '#d97706',
        tab: 'inventory',
      },
      {
        icon: 'two_wheeler',
        label: 'Active Riders',
        value: `${activeRidersCount}`,
        sub: `${allRiders.filter((r) => r.riderStatus === 'On Delivery').length} on delivery`,
        color: '#0284c7',
        tab: 'riders',
      },
    ];

    res.status(200).json({
      success: true,
      storeId,
      kpis,
      latestOrders: orders.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/orders
 * Retrieve orders for store admin
 */
const getOrders = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { status } = req.query;

    const orders = await getStoreOrders(storeId, status);
    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/store-admin/orders/:id/status
 * Advance order status in the pipeline
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStages = ['Pending', 'Cutting', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'];
    if (!validStages.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status' });
    }

    const order = await getOrderByIdFS(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Safeguard: Delivery orders cannot be marked Out for Delivery without an assigned rider
    if (status === 'Out for Delivery' && order.fulfillmentType !== 'pickup' && !order.pickupMode) {
      const hasRider = Boolean(order.rider?.riderId || (order.rider?.name && order.rider.name.trim().length > 0));
      if (!hasRider) {
        return res.status(400).json({
          success: false,
          message: 'Cannot mark order Out for Delivery without assigning a delivery partner. Please assign a rider.',
        });
      }
    }

    const updatedResult = await updateOrderStatusFS(id, status, {
      id: req.user?._id || req.user?.id,
      name: req.user?.name || 'Store Admin',
      role: req.user?.role || 'storeadmin',
    });

    const updatedOrder = updatedResult.order || order;
    updatedOrder.status = status;

    if (status === 'Out for Delivery' && !updatedOrder.deliveryOtp && updatedOrder.fulfillmentType !== 'pickup') {
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      await updateDoc('orders', id, { deliveryOtp: generatedOtp }).catch(() => {});
      updatedOrder.deliveryOtp = generatedOtp;
    }

    emitOrderStatusUpdate(id, updatedOrder);

    // Push notification to customer on status update
    if (order.customer && order.customer.userId) {
      const titles = {
        Cutting: 'Meat Cutting Started',
        Ready: order.fulfillmentType === 'pickup' ? 'Order Ready for Pickup' : 'Order Packed & Ready',
        'Out for Delivery': 'Out for Delivery',
        Delivered: 'Order Delivered',
        Cancelled: 'Order Cancelled',
      };
      const bodies = {
        Cutting: `Our team is preparing your fresh cuts for order #${order.orderId || id}.`,
        Ready: order.fulfillmentType === 'pickup'
          ? `Your order #${order.orderId || id} is packed and ready for takeaway at the store counter.`
          : `Order #${order.orderId || id} is packed and awaiting rider dispatch.`,
        'Out for Delivery': `Your order #${order.orderId || id} is on the way to your address!`,
        Delivered: `Your order #${order.orderId || id} has been delivered. Thank you for choosing Teffe's!`,
        Cancelled: `Your order #${order.orderId || id} has been cancelled.`,
      };

      if (titles[status]) {
        notificationService.sendToUser(order.customer.userId, {
          title: titles[status],
          body: bodies[status],
          data: {
            notificationType: 'ORDER_STATUS',
            orderId: order.orderId || id,
            status,
            clickAction: `/dashboard?orderId=${order.orderId || id}`,
          },
        }).catch((err) => console.warn('[FCM] Status notification error:', err.message));
      }
    }

    res.status(200).json({
      success: true,
      message: `Order status advanced to ${status}`,
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/store-admin/orders/:id/delay-prep
 * Extend prep time if rush occurs at butchery counter
 */
const delayPrepTime = async (req, res, next) => {
  try {
    const { id } = req.params;
    const extraMinutes = Number(req.body.extraMinutes) || 10;

    const order = await getOrderByIdFS(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const newPrepTime = (order.prepTimeMinutes || 25) + extraMinutes;
    const currentTarget = order.targetDeliveryTime ? new Date(order.targetDeliveryTime).getTime() : Date.now();
    const newTarget = new Date(currentTarget + extraMinutes * 60 * 1000).toISOString();

    await updateDoc('orders', id, {
      prepTimeMinutes: newPrepTime,
      targetDeliveryTime: newTarget,
      updatedAt: new Date().toISOString(),
    });

    order.prepTimeMinutes = newPrepTime;
    order.targetDeliveryTime = newTarget;

    emitOrderStatusUpdate(order.orderId || id, order);

    res.status(200).json({
      success: true,
      message: `Prep time extended by +${extraMinutes} mins. New customer ETA updated.`,
      order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/inventory
 * Inventory list for this store
 */
const getInventory = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const inventory = await getStoreInventory(storeId);

    res.status(200).json({
      success: true,
      count: inventory.length,
      inventory,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/store-admin/inventory/:id
 * Update stock kg, defreeze stock, or minimum threshold with audit history
 */
const updateInventoryItem = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { id } = req.params;
    const {
      stock,
      defreezeStock,
      wasteStock,
      min,
      reason,
      classification,
      operation,
      quantity,
    } = req.body;

    // Load existing record to allow relative operation adjustments
    const existing = await getInventoryItem(storeId, id);
    if (!existing) {
      return res.status(404).json({ success: false, message: `Inventory item "${id}" not found in store "${storeId}"` });
    }

    const updates = {};

    // 1. Handle classification + operation (add / reduce / set) from frontend modal
    if (classification && operation) {
      const qty = Number(quantity);
      if (!isNaN(qty)) {
        if (classification === 'defreeze') {
          const currentDefreeze = Number(existing.defreezeStock) || 0;
          let newDefreeze = currentDefreeze;
          if (operation === 'add') newDefreeze = Math.round((currentDefreeze + qty) * 1000) / 1000;
          else if (operation === 'reduce') newDefreeze = Math.max(0, Math.round((currentDefreeze - qty) * 1000) / 1000);
          else if (operation === 'set') newDefreeze = Math.max(0, qty);
          updates.defreezeStock = newDefreeze;
        } else if (classification === 'waste') {
          const currentWaste = Number(existing.wasteStock) || 0;
          let newWaste = currentWaste;
          if (operation === 'add') newWaste = Math.round((currentWaste + qty) * 1000) / 1000;
          else if (operation === 'reduce') newWaste = Math.max(0, Math.round((currentWaste - qty) * 1000) / 1000);
          else if (operation === 'set') newWaste = Math.max(0, qty);
          updates.wasteStock = newWaste;
        } else {
          // Default to fresh stock
          const currentFresh = Number(existing.stock) || 0;
          let newFresh = currentFresh;
          if (operation === 'add') newFresh = Math.round((currentFresh + qty) * 1000) / 1000;
          else if (operation === 'reduce') newFresh = Math.max(0, Math.round((currentFresh - qty) * 1000) / 1000);
          else if (operation === 'set') newFresh = Math.max(0, qty);
          updates.stock = newFresh;
        }
      }
    }

    // 2. Direct overrides if provided explicitly
    if (stock !== undefined) updates.stock = Math.max(0, Number(stock));
    if (defreezeStock !== undefined) updates.defreezeStock = Math.max(0, Number(defreezeStock));
    if (wasteStock !== undefined) updates.wasteStock = Math.max(0, Number(wasteStock));
    if (min !== undefined && min !== '' && min !== null) updates.min = Math.max(0, Number(min));
    updates.lastRestocked = `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const updated = await updateInventoryItemFS(storeId, id, updates, req.user, reason);

    // Notify waiting customers if fresh stock was replenished and is now > 0
    if (updated && Number(updated.stock) > 0) {
      (async () => {
        try {
          const { queryDocs, updateDoc } = require('../lib/firestore');
          const notificationService = require('../services/notificationService');
          const allSubs = await queryDocs('stock_notifications', (ref) =>
            ref.where('productId', '==', productId)
          );
          const pendingSubs = allSubs.filter((s) => s.status === 'pending');

          for (const sub of pendingSubs) {
            await updateDoc('stock_notifications', sub.id, {
              status: 'notified',
              notifiedAt: new Date().toISOString(),
            });

            if (sub.userId) {
              notificationService.sendToUser(sub.userId, {
                title: 'Back in Stock: ' + (sub.productName || 'Fresh Item'),
                body: `Great news! ${sub.productName || 'Your saved cut'} is now freshly in stock at our hub. Order now before it runs out!`,
                data: {
                  notificationType: 'STOCK_RESTOCKED',
                  productId: sub.productId,
                  clickAction: `/product/${sub.productId}`,
                },
              }).catch(() => {});
            }
          }
        } catch (subErr) {
          console.warn('[StockNotificationAlert Error]:', subErr.message);
        }
      })();
    }

    try {
      emitInventoryUpdate(storeId, [updated]);
    } catch (_) {}

    res.status(200).json({ success: true, item: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/store-admin/inventory/transfer
 * Move De-Freeze stock to Fresh Inventory
 */
const transferDefreezeStock = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { itemId, quantity, notes } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Item ID is required.' });
    }

    const result = await transferDefreezeToFreshTransactional({
      storeId,
      itemId,
      quantity,
      user: req.user,
      notes,
    });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/store-admin/inventory/waste
 * Record Damaged, Spoiled, Expired, or Wasted stock
 */
const recordInventoryWaste = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { itemId, sourceClassification, quantity, reason, notes } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Item ID is required.' });
    }

    const result = await recordDamageWasteTransactional({
      storeId,
      itemId,
      sourceClassification: sourceClassification || 'fresh',
      quantity,
      reason,
      notes,
      user: req.user,
    });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/inventory/history
 * List audit history entries for stock movements and deductions
 */
const getInventoryHistory = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { itemId, actionType, classification, search, startDate, endDate, page = 1, limit = 50 } = req.query;

    const result = await getInventoryHistoryFS(storeId, {
      itemId,
      actionType,
      classification,
      search,
      startDate,
      endDate,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/customers
 * List customers who placed orders at this store
 */
const getStoreCustomers = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);

    const orders = await getStoreOrders(storeId);
    const map = new Map();

    for (const o of orders) {
      // Exclude cancelled and failed payment orders
      if (o.status === 'Cancelled' || o.paymentStatus === 'Failed') continue;

      const rawPhone = o.customer?.phone || '';
      const cleanPhone = String(rawPhone).replace(/\D/g, '').slice(-10);
      const key = cleanPhone || rawPhone || 'Unknown';

      const amt = Number(o.amount != null ? o.amount : o.totalAmount) || 0;
      const orderDate = o.createdAt ? new Date(o.createdAt) : new Date();

      if (!map.has(key)) {
        map.set(key, {
          id: `CUST-${cleanPhone ? cleanPhone.slice(-4) : (o.customer?.userId || '0000')}`,
          name: o.customer?.name || 'Customer',
          phone: cleanPhone ? `+91 ${cleanPhone}` : (rawPhone || 'Unknown'),
          address: o.customer?.address || o.shippingAddress?.address || 'Ranchi',
          orders: 1,
          totalOrders: 1,
          totalSpent: amt,
          lastOrder: o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'Today',
          _lastOrderDate: orderDate,
        });
      } else {
        const entry = map.get(key);
        entry.orders += 1;
        entry.totalOrders = entry.orders;
        entry.totalSpent = Math.round((entry.totalSpent + amt) * 100) / 100;

        // Keep most descriptive name if current name is generic
        const genericNames = ['verified gourmet user', 'valued customer', 'customer'];
        const currentNameLower = (entry.name || '').trim().toLowerCase();
        const orderName = (o.customer?.name || '').trim();
        if (orderName && (!entry.name || genericNames.includes(currentNameLower))) {
          entry.name = orderName;
        }

        // Keep latest address and order date
        if (orderDate >= entry._lastOrderDate) {
          entry._lastOrderDate = orderDate;
          entry.lastOrder = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'Today';
          if (o.customer?.address || o.shippingAddress?.address) {
            entry.address = o.customer?.address || o.shippingAddress?.address;
          }
        }
      }
    }

    const customers = Array.from(map.values()).map((c) => {
      delete c._lastOrderDate;
      c.totalSpent = Math.round(c.totalSpent * 100) / 100;
      return c;
    });

    customers.sort((a, b) => (b.totalOrders || b.orders || 0) - (a.totalOrders || a.orders || 0));

    res.status(200).json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/slots
 * List delivery slots & occupancy
 */
const getDeliverySlots = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const slots = await getStoreDeliverySlots(storeId);

    res.status(200).json({
      success: true,
      count: slots.length,
      slots,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/store-admin/slots/:id
 * Update slot capacity or status
 */
const updateDeliverySlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await updateDoc('delivery_slots', id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    res.status(200).json({ success: true, slot: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/returns
 * List return & exchange tickets
 */
const getReturnRequests = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const returns = await getStoreReturnRequests(storeId);

    res.status(200).json({
      success: true,
      count: returns.length,
      returns,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/store-admin/returns/:id/status
 * Approve or update status of return request
 */
const updateReturnStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const returnReq = await updateReturnStatusFS({
      requestId: id,
      status,
      adminUser: req.user,
      notes,
    });

    res.status(200).json({ success: true, returnRequest: returnReq });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/store-admin/returns/:id/assign-rider
 * Assign rider for reverse pickup
 */
const assignRiderToReturnRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;

    const returnReq = await assignRiderToReturnFS({
      requestId: id,
      riderId,
      adminUser: req.user,
    });

    // Notify rider via FCM push notification
    notificationService.sendToRider(riderId, {
      title: 'Return Meat Pickup Request',
      body: `Reverse pickup #${returnReq.requestId || id} assigned. Collect meat from customer and return to store.`,
      data: {
        notificationType: 'RETURN_ASSIGNMENT',
        isReturn: 'true',
        orderId: returnReq.orderId || id,
        requestId: returnReq.requestId || id,
        clickAction: `/rider/orders/${returnReq.orderId || id}`,
      },
    }).catch((err) => console.warn('[FCM] Rider return push error:', err.message));

    if (returnReq.orderId) {
      emitOrderStatusUpdate(returnReq.orderId, {
        orderId: returnReq.orderId,
        returnStatus: 'Pickup Assigned',
        isReturn: true,
        rider: returnReq.rider,
      });
    }

    res.status(200).json({ success: true, returnRequest: returnReq });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/store-admin/returns/:id/verify-otp
 * Verify 4-digit return OTP on package handover (credits customer wallet & logs to waste inventory)
 */
const verifyReturnOtp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    const returnReq = await verifyReturnOtpAndCompleteFS({
      requestId: id,
      returnOtp: otp,
      actorUser: req.user,
    });

    res.status(200).json({
      success: true,
      message: 'Return pickup verified, meat added to waste inventory and customer refunded',
      returnRequest: returnReq,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/riders
 * Get riders for this store
 */
const getRiders = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);

    let allRiders = await queryDocs('users', (ref) => ref.where('role', '==', 'rider'));
    if (!allRiders || allRiders.length === 0) {
      const allUsers = await queryDocs('users');
      allRiders = allUsers.filter((u) => String(u.role || '').toLowerCase() === 'rider');
    }

    let storeRiders = allRiders.filter(
      (r) => !r.storeId || resolveStoreId(r.storeId) === storeId || r.storeId === 'all'
    );
    if (storeRiders.length === 0) storeRiders = allRiders;

    let activeOrders = [];
    try {
      const orders = await getStoreOrders(storeId);
      activeOrders = (orders || []).filter((o) => o.status === 'Out for Delivery');
    } catch (orderErr) {
      console.warn('[StoreAdmin] Error fetching store orders for rider status sync:', orderErr.message);
    }

    const activeRiderIdentifiers = new Set();
    activeOrders.forEach((o) => {
      if (o.rider?.riderId) activeRiderIdentifiers.add(String(o.rider.riderId));
      if (o.rider?.phone) activeRiderIdentifiers.add(String(o.rider.phone).replace(/\D/g, ''));
      if (o.rider?.name) activeRiderIdentifiers.add(String(o.rider.name).trim().toLowerCase());
    });

    const updatedRiders = await Promise.all(
      storeRiders.map(async (r) => {
        const idStr = r.id || (r._id ? r._id.toString() : '');
        const phoneStr = (r.phone || '').replace(/\D/g, '');
        const nameStr = (r.name || '').trim().toLowerCase();

        const isOnDelivery =
          activeRiderIdentifiers.has(idStr) ||
          (phoneStr && activeRiderIdentifiers.has(phoneStr)) ||
          (nameStr && activeRiderIdentifiers.has(nameStr));

        const copy = { ...r };
        delete copy.password;

        try {
          if (isOnDelivery && r.riderStatus !== 'On Delivery') {
            await updateDoc('users', idStr, { riderStatus: 'On Delivery' });
            copy.riderStatus = 'On Delivery';
          } else if (!isOnDelivery && r.riderStatus === 'On Delivery') {
            await updateDoc('users', idStr, { riderStatus: 'Available' });
            copy.riderStatus = 'Available';
          }
        } catch (syncErr) {
          // Non-blocking status sync
        }

        try {
          copy.cashInHand = await calculateRiderCashInHand(idStr, r.phone);
        } catch (cashErr) {
          copy.cashInHand = 0;
        }

        return copy;
      })
    );

    res.status(200).json({ success: true, count: updatedRiders.length, riders: updatedRiders });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/store-admin/orders/:id/assign-rider
 * Assign a rider to an order
 */
const assignRiderToOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;

    const rider = await getDoc('users', riderId);
    if (!rider || rider.role !== 'rider') {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }

    const order = await getOrderByIdFS(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const storeId = getEffectiveStoreId(req);
    const result = await createDeliveryBatchTransactional({
      orderIds: [id],
      riderId,
      storeId,
      actor: {
        id: req.user?.id || req.user?._id,
        name: req.user?.name || 'Store Admin',
        role: req.user?.role || 'store_admin',
      },
    });

    const docId = order.id || order._id || id;
    const updatedOrder = await getOrderByIdFS(id);

    emitOrderStatusUpdate(order.orderId || id, updatedOrder || order);
    if (docId !== (order.orderId || id)) {
      emitOrderStatusUpdate(docId, updatedOrder || order);
    }

    // Push notification to rider
    notificationService.sendToRider(rider.id || riderId, {
      title: 'New Delivery Assignment',
      body: `Order #${order.orderId || id} assigned to you. Deliver to ${order.customer?.name || 'Customer'}.`,
      data: {
        notificationType: 'DELIVERY_ASSIGNMENT',
        orderId: order.orderId || id,
        clickAction: `/rider/orders/${order.orderId || id}`,
      },
    }).catch((err) => console.warn('[FCM] Rider assignment push error:', err.message));

    // Push notification to customer
    if (order.customer && order.customer.userId) {
      notificationService.sendToUser(order.customer.userId, {
        title: 'Rider Assigned',
        body: `${rider.name} has been assigned to deliver your order #${order.orderId || id}.`,
        data: {
          notificationType: 'ORDER_STATUS',
          orderId: order.orderId || id,
          status: 'Out for Delivery',
          clickAction: `/dashboard?orderId=${order.orderId || id}`,
        },
      }).catch((err) => console.warn('[FCM] Customer rider push error:', err.message));
    }

    res.status(200).json({ success: true, order, rider });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/store-status
 * Retrieve operational hours and live online/paused status
 */
const getStoreStatus = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    let store = await getStoreById(storeId);
    if (!store) {
      store = await createStoreFS({
        storeId,
        name: storeId === 'S004' ? "TeFFe's — Doranda Hub" : 'Kishore Ganj Store',
        city: 'Ranchi',
        address: 'Ranchi, Jharkhand',
        isOpen: true,
        status: 'Active',
        timings: '08:00 AM - 08:00 PM',
        pickupEnabled: true,
        deliveryEnabled: true,
      });
    }
    res.status(200).json({ success: true, store });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/store-admin/store-status
 * Toggle store online/paused status, timings, or emergency notice
 */
const updateStoreStatus = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);

    const store = await updateStoreFS(storeId, req.body);
    res.status(200).json({ success: true, store });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/remittances
 * List all cash remittance requests for this store
 */
const getStoreRemittances = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const remittances = await getStoreRemittancesFS(storeId);
    res.status(200).json({ success: true, count: remittances.length, remittances });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/store-admin/remittances/:id/confirm
 * Store admin confirms physical cash deposit received from rider
 */
const confirmRemittance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const confirmed = await confirmRemittanceTransactional(id, req.user);

    res.status(200).json({
      success: true,
      message: `Cash remittance confirmed successfully.`,
      remittance: confirmed,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/store-admin/remittances/collect
 * Store admin directly receives and settles cash from a rider at the counter
 */
const collectRiderCash = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { riderId, amount, notes } = req.body;
    if (!riderId) return res.status(400).json({ success: false, message: 'Rider ID is required' });
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid deposit amount greater than zero is required' });
    }

    const rider = await getDoc('users', riderId);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    // 1. Submit remittance record
    const { remittance } = await submitRemittance({
      rider,
      amount: numAmount,
      notes: notes || 'Counter cash settlement collected by Store Admin',
      storeId,
      storeName: req.user?.storeName || `Store ${storeId}`,
    });

    // 2. Confirm it immediately
    const confirmed = await confirmRemittanceTransactional({
      remittanceId: remittance.remittanceId || remittance.id,
      adminUser: req.user,
      notes: notes || 'Cash received and verified at counter',
    });

    const newCashInHand = await calculateRiderCashInHand(rider.id, rider.phone);

    res.status(200).json({
      success: true,
      message: `₹${numAmount.toFixed(2)} cash collected from ${rider.name} and settled successfully.`,
      remittance: confirmed,
      remainingCashInHand: newCashInHand,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/store-admin/batches/check-feasibility
 * Evaluate route feasibility for a candidate set of orders
 */
const checkBatchFeasibility = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'orderIds array is required' });
    }

    const store = await getStoreById(storeId);
    const storeCoords = {
      lat: store?.lat || 23.3441,
      lng: store?.lng || 85.3096,
    };

    const orders = [];
    for (const id of orderIds) {
      const o = await getOrderByIdFS(String(id).trim());
      if (o) orders.push(o);
    }

    if (orders.length !== orderIds.length) {
      return res.status(404).json({ success: false, message: 'One or more orders could not be found' });
    }

    const result = await evaluateRouteFeasibility({
      storeId,
      storeCoords,
      orders,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/store-admin/batches/assign
 * Create and dispatch a delivery batch atomically
 */
const createDeliveryBatch = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { riderId, orderIds } = req.body;

    if (!riderId || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'riderId and orderIds array are required' });
    }

    const result = await createDeliveryBatchTransactional({
      storeId,
      riderId,
      orderIds,
      adminUser: req.user,
    });

    const { batch, orders, rider } = result;

    for (const item of orders) {
      const ord = await getOrderByIdFS(item.orderId);
      if (ord) {
        emitOrderStatusUpdate(ord.orderId || ord.id, ord);
        if (ord.customer?.userId) {
          notificationService.sendToUser(ord.customer.userId, {
            title: 'Order Dispatched',
            body: `${rider.name} has picked up your order and is out for delivery.`,
            data: {
              notificationType: 'ORDER_STATUS',
              orderId: ord.orderId || ord.id,
              status: 'Out for Delivery',
              clickAction: `/dashboard?orderId=${ord.orderId || ord.id}`,
            },
          }).catch((err) => console.warn('[FCM] Customer rider push error:', err.message));
        }
      }
    }

    notificationService.sendToRider(rider.id || riderId, {
      title: 'New Delivery Batch Assigned',
      body: `You have been assigned ${orders.length} deliveries. Deliver to #${orders[0].orderId} first.`,
      data: {
        notificationType: 'DELIVERY_BATCH_ASSIGNMENT',
        batchId: batch.batchId,
        clickAction: `/rider/orders/${orders[0].orderId}`,
      },
    }).catch((err) => console.warn('[FCM] Rider assignment push error:', err.message));

    res.status(200).json({
      success: true,
      message: `Batch of ${orders.length} orders assigned to ${rider.name} successfully.`,
      batch,
      orders,
      rider,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/batches/settings
 * Retrieve configurable batch limits for this store
 */
const getStoreBatchSettings = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const config = await getStoreBatchConfig(storeId);
    res.status(200).json({ success: true, config });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/store-admin/batches/settings
 * Update configurable batch limits for this store
 */
const updateStoreBatchSettings = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const config = await updateStoreBatchConfig(storeId, req.body);
    res.status(200).json({
      success: true,
      message: 'Batch settings updated successfully.',
      config,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardOverview,
  getOrders,
  updateOrderStatus,
  delayPrepTime,
  getInventory,
  updateInventoryItem,
  transferDefreezeStock,
  recordInventoryWaste,
  getInventoryHistory,
  getStoreCustomers,
  getDeliverySlots,
  updateDeliverySlot,
  getReturnRequests,
  updateReturnStatus,
  assignRiderToReturnRequest,
  verifyReturnOtp,
  getRiders,
  assignRiderToOrder,
  getStoreStatus,
  updateStoreStatus,
  getStoreRemittances,
  confirmRemittance,
  collectRiderCash,
  checkBatchFeasibility,
  createDeliveryBatch,
  getStoreBatchSettings,
  updateStoreBatchSettings,
};

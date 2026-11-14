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
  getPaginatedOrders: getPaginatedOrdersFS,
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
  calculateInventoryStatus,
  matchCartItemToInventory,
  getItemRequiredAmount,
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
const { emitOrderStatusUpdate, emitInventoryUpdate, emitOrderCreated } = require('../socket');
const { getTodayISTDateString } = require('../utils/etaCalculator');

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
 * Safely parses any date/timestamp format from Firestore (Timestamp object, seconds, ISO string, Date) to milliseconds.
 */
const parseDateToMillis = (val) => {
  if (!val) return null;
  if (typeof val?.toDate === 'function') {
    try { return val.toDate().getTime(); } catch (_) {}
  }
  if (typeof val === 'object') {
    const s = val._seconds ?? val.seconds;
    if (typeof s === 'number') return s * 1000;
  }
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const t = new Date(val).getTime();
    if (!isNaN(t)) return t;
  }
  if (val instanceof Date) {
    const t = val.getTime();
    if (!isNaN(t)) return t;
  }
  return null;
};

/**
 * Formats a timestamp into DD/MM/YYYY in Indian Standard Time (IST).
 */
const formatDDMMYYYY_IST = (dateInput) => {
  const ms = parseDateToMillis(dateInput);
  if (!ms) return '';
  const istDate = new Date(ms + (5.5 * 60 * 60 * 1000));
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const year = istDate.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Calculates calendar days elapsed between an order and today in IST.
 * - Order placed today in IST -> 0
 * - Order placed yesterday in IST -> 1
 * - Order placed N calendar days ago in IST -> N
 */
const getCalendarDaysSinceOrderIST = (orderDateInput, refNowMs = Date.now()) => {
  const orderMs = parseDateToMillis(orderDateInput);
  if (!orderMs) return null;

  const orderIST = new Date(orderMs + (5.5 * 60 * 60 * 1000));
  const orderDayStartMs = Date.UTC(orderIST.getUTCFullYear(), orderIST.getUTCMonth(), orderIST.getUTCDate());

  const nowIST = new Date(refNowMs + (5.5 * 60 * 60 * 1000));
  const nowDayStartMs = Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate());

  const diffDays = Math.round((nowDayStartMs - orderDayStartMs) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
};

/**
 * Resolves the operational delivery date for an order in YYYY-MM-DD IST format.
 * If order was placed after 8PM, or during half-day / holiday cutoff, or explicitly marked
 * for next-day delivery, it is credited to the date it is SCHEDULED TO BE DELIVERED.
 */
const getOrderDeliveryDateIST = (order) => {
  if (!order) return '';

  // 1. Explicit scheduled delivery date (YYYY-MM-DD)
  if (order.scheduledDeliveryDate && typeof order.scheduledDeliveryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(order.scheduledDeliveryDate)) {
    return order.scheduledDeliveryDate;
  }

  // 2. targetDeliveryTime converted to IST date string
  const targetMs = parseDateToMillis(order.targetDeliveryTime);
  if (targetMs) {
    const istMs = targetMs + (5.5 * 60 * 60 * 1000);
    return new Date(istMs).toISOString().slice(0, 10);
  }

  // 3. Fallback to createdAt / created_at / orderDate + next-day detection
  const createdMs = parseDateToMillis(order.createdAt || order.created_at || order.orderDate);
  if (createdMs) {
    const slot = String(order.deliverySlot || '').toLowerCase();
    const isNextDay = Boolean(
      order.isNextDayOrder ||
      slot.includes('tomorrow') ||
      slot.includes('next-day') ||
      slot.includes('9:00 am')
    );
    const istMs = createdMs + (5.5 * 60 * 60 * 1000) + (isNextDay ? 24 * 60 * 60 * 1000 : 0);
    return new Date(istMs).toISOString().slice(0, 10);
  }

  return '';
};

/**
 * Checks if an order's scheduled delivery date matches the chosen time range.
 */
const isOrderInDateRange = (order, timeRange = 'all', customStart = '', customEnd = '') => {
  const mode = String(timeRange || 'all').toLowerCase();
  if (mode === 'all') return true;

  const deliveryDate = getOrderDeliveryDateIST(order);
  // If an order has no identifiable delivery date, do NOT include it in specific date filters like 'today'
  if (!deliveryDate) return false;

  const todayIST = getTodayISTDateString();

  const getPastDateIST = (daysAgo) => {
    const todayMs = new Date(todayIST + 'T00:00:00Z').getTime();
    return new Date(todayMs - (daysAgo * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  };

  switch (mode) {
    case 'today':
      return deliveryDate === todayIST;
    case 'last7days':
      return deliveryDate >= getPastDateIST(6) && deliveryDate <= todayIST;
    case 'last30days':
      return deliveryDate >= getPastDateIST(29) && deliveryDate <= todayIST;
    case 'last90days':
      return deliveryDate >= getPastDateIST(89) && deliveryDate <= todayIST;
    case 'last12months':
      return deliveryDate >= getPastDateIST(365) && deliveryDate <= todayIST;
    case 'custom':
      if (customStart && customEnd) {
        return deliveryDate >= customStart && deliveryDate <= customEnd;
      }
      if (customStart) return deliveryDate >= customStart;
      if (customEnd) return deliveryDate <= customEnd;
      return true;
    case 'all':
    default:
      return true;
  }
};

/**
 * GET /api/store-admin/dashboard
 * Store Admin KPI summary & latest orders with operational delivery date filtering
 */
const getDashboardOverview = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const timeRange = (req.query?.timeRange || req.query?.filter || 'all').toLowerCase();
    const customStart = req.query?.startDate || '';
    const customEnd = req.query?.endDate || '';

    const [orders, allRiders] = await Promise.all([
      getStoreOrders(storeId),
      queryDocs('users', (ref) => ref.where('role', '==', 'rider')),
    ]);

    // Authoritative date filtering based on operational delivery date
    const filteredOrders = orders.filter((o) => isOrderInDateRange(o, timeRange, customStart, customEnd));

    const totalOrdersCount = filteredOrders.length;
    const totalRevenue = filteredOrders
      .filter((o) => o.status !== 'Cancelled' && o.status !== 'Rejected')
      .reduce((sum, o) => sum + (Number(o.amount || o.totalAmount || 0)), 0);

    const pendingOrdersCount = filteredOrders.filter((o) =>
      ['Pending', 'Cutting', 'Ready', 'Out for Delivery'].includes(o.status)
    ).length;

    const completedOrdersCount = filteredOrders.filter((o) =>
      o.status === 'Delivered' || o.status === 'Completed'
    ).length;

    const totalRidersCount = allRiders.length;
    const activeRidersCount = allRiders.filter((r) => r.isActive !== false && (!r.storeId || resolveStoreId(r.storeId) === storeId)).length;

    // Formatted Indian revenue string
    const formattedRevenue = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }).format(totalRevenue);

    const kpis = [
      {
        icon: 'receipt_long',
        label: 'Total orders',
        value: `${totalOrdersCount}`,
        sub: timeRange === 'today' ? "Today's placed orders" : 'In selected period',
        color: '#1e3a8a',
        tab: 'orders',
        hasInfo: true,
        infoText: 'Total orders scheduled for delivery in selected date range',
      },
      {
        icon: 'payments',
        label: 'Total revenue',
        value: `₹${formattedRevenue}`,
        sub: 'Excluding cancellations',
        color: '#047857',
        tab: 'orders',
        hasInfo: true,
        infoText: 'Gross revenue of valid orders in selected date range',
      },
      {
        icon: 'pending_actions',
        label: 'Total pending orders',
        value: `${pendingOrdersCount}`,
        sub: 'Pending, Cutting, Ready & In Transit',
        color: '#b45309',
        tab: 'orders',
        hasInfo: true,
        infoText: 'Orders currently awaiting cutting, packaging or doorstep delivery',
      },
      {
        icon: 'check_circle',
        label: 'Total completed orders',
        value: `${completedOrdersCount}`,
        sub: 'Successfully delivered',
        color: '#059669',
        tab: 'orders',
        hasInfo: true,
        infoText: 'Orders successfully delivered in selected date range',
      },
      {
        icon: 'two_wheeler',
        label: 'Total riders',
        value: `${totalRidersCount}`,
        sub: `${activeRidersCount} active on field`,
        color: '#0284c7',
        tab: 'riders',
        hasInfo: true,
        infoText: 'Total delivery fleet partners registered in system',
      },
    ];

    res.status(200).json({
      success: true,
      storeId,
      timeRange,
      kpis,
      statusBreakdown: {
        all: totalOrdersCount,
        new: filteredOrders.filter((o) => o.status === 'Pending').length,
        cutting: filteredOrders.filter((o) => o.status === 'Cutting').length,
        ready: filteredOrders.filter((o) => o.status === 'Ready').length,
        inTransit: filteredOrders.filter((o) => o.status === 'Out for Delivery').length,
        completed: completedOrdersCount,
        others: filteredOrders.filter((o) => o.status === 'Cancelled' || o.status === 'Rejected').length,
      },
      latestOrders: filteredOrders.slice(0, 15),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/orders
 * Retrieve orders for store admin (with server-side pagination & live queue protection)
 */
const getOrders = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { status, page, limit } = req.query;

    if (page !== undefined || limit !== undefined) {
      const result = await getPaginatedOrdersFS({
        storeId,
        status,
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 50,
      });

      return res.status(200).json({
        success: true,
        count: result.orders.length,
        totalCount: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        orders: result.orders,
      });
    }

    let orders = await getStoreOrders(storeId, status);
    // For live store operations queue without pagination, protect from loading 11,000 legacy records
    if (!status || status === 'all') {
      orders = orders.filter((o) => !o.isMigrated);
    }

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

    const cancelReason = req.body?.reason ? String(req.body.reason).trim() : '';
    const updatedResult = await updateOrderStatusFS(id, status, {
      id: req.user?._id || req.user?.id,
      name: req.user?.name || 'Store Admin',
      role: req.user?.role || 'storeadmin',
    }, cancelReason);

    const updatedOrder = updatedResult.order || order;
    updatedOrder.status = status;

    if (status === 'Cancelled' && cancelReason) {
      await updateDoc('orders', id, { cancellationReason: cancelReason, updatedAt: new Date().toISOString() }).catch(() => {});
      updatedOrder.cancellationReason = cancelReason;
    }

    if (status === 'Out for Delivery' && !updatedOrder.deliveryOtp && updatedOrder.fulfillmentType !== 'pickup') {
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      await updateDoc('orders', id, { deliveryOtp: generatedOtp }).catch(() => {});
      updatedOrder.deliveryOtp = generatedOtp;
    }

    emitOrderStatusUpdate(id, updatedOrder);

    // Reconcile batch and rider quota when an order is marked Delivered or Cancelled
    if (status === 'Delivered' || status === 'Cancelled') {
      try {
        const orderIdVal = order.orderId || id;
        const batchId = order.batchId || updatedOrder.batchId;
        const riderId = order.rider?.riderId || order.rider?.id || updatedOrder.rider?.riderId;

        if (batchId) {
          const batchDoc = await getDoc('delivery_batches', String(batchId).trim());
          if (batchDoc) {
            const completedList = Array.from(new Set([
              ...(batchDoc.completedOrderIds || []),
              ...(status === 'Delivered' ? [id, orderIdVal] : []),
            ]));
            const cancelledList = Array.from(new Set([
              ...(batchDoc.cancelledOrderIds || []),
              ...(status === 'Cancelled' ? [id, orderIdVal] : []),
            ]));
            const allOrderIds = batchDoc.orderIds || [];
            const remaining = allOrderIds.filter(
              (oid) => !completedList.includes(oid) && !cancelledList.includes(oid)
            );

            const batchPatch = {
              completedOrderIds: completedList,
              cancelledOrderIds: cancelledList,
              updatedAt: new Date().toISOString(),
            };

            let isBatchDone = false;
            if (remaining.length === 0) {
              isBatchDone = true;
              batchPatch.status = 'Completed';
              batchPatch.completedAt = new Date().toISOString();
              batchPatch.activeOrderId = null;
            } else if (batchDoc.activeOrderId === id || batchDoc.activeOrderId === orderIdVal) {
              batchPatch.activeOrderId = remaining[0];
              batchPatch.currentSequence = allOrderIds.indexOf(remaining[0]) + 1;
            }

            await updateDoc('delivery_batches', String(batchId).trim(), batchPatch).catch(() => {});

            const targetRiderId = riderId || batchDoc.riderId;
            if (isBatchDone && targetRiderId) {
              await updateDoc('users', String(targetRiderId).trim(), {
                riderStatus: 'Available',
                activeBatchId: null,
                currentOrderId: null,
                updatedAt: new Date().toISOString(),
              }).catch(() => {});
              await updateDoc('riders', String(targetRiderId).trim(), {
                riderStatus: 'Available',
                activeBatchId: null,
                currentOrderId: null,
                updatedAt: new Date().toISOString(),
              }).catch(() => {});
            }
          }
        } else if (riderId) {
          const activeOrders = await queryDocs('orders', (ref) =>
            ref.where('rider.riderId', '==', String(riderId).trim()).where('status', '==', 'Out for Delivery')
          );
          const stillActive = (activeOrders || []).filter((o) => (o.id !== id && o.orderId !== orderIdVal));
          if (stillActive.length === 0) {
            await updateDoc('users', String(riderId).trim(), {
              riderStatus: 'Available',
              activeBatchId: null,
              currentOrderId: null,
              updatedAt: new Date().toISOString(),
            }).catch(() => {});
            await updateDoc('riders', String(riderId).trim(), {
              riderStatus: 'Available',
              activeBatchId: null,
              currentOrderId: null,
              updatedAt: new Date().toISOString(),
            }).catch(() => {});
          }
        }
      } catch (syncErr) {
        console.warn('[StoreAdmin] Batch/Rider reconcile on status update warning:', syncErr.message);
      }
    }

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
        Cancelled: cancelReason
          ? `Order #${order.orderId || id} was cancelled: ${cancelReason}`
          : `Your order #${order.orderId || id} has been cancelled.`,
      };

      if (titles[status]) {
        notificationService.sendToUser(order.customer.userId, {
          title: titles[status],
          body: bodies[status],
          data: {
            notificationType: 'ORDER_STATUS',
            orderId: order.orderId || id,
            status,
            reason: cancelReason || '',
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
    const extraMinutes = Number(req.body.extraMinutes);

    if (!extraMinutes || isNaN(extraMinutes) || extraMinutes <= 0) {
      return res.status(400).json({ success: false, message: 'extraMinutes must be a positive number (e.g. 10, 20, 30, 60).' });
    }

    const order = await getOrderByIdFS(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Status guard: Cannot delay if already delivered or cancelled
    if (order.status === 'Delivered' || order.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot delay preparation because order is already ${order.status}.`,
      });
    }

    const docId = order.id || order._id || id;
    const newPrepTime = (order.prepTimeMinutes || 25) + extraMinutes;
    const currentTarget = order.targetDeliveryTime ? new Date(order.targetDeliveryTime).getTime() : Date.now();
    const newTarget = new Date(currentTarget + extraMinutes * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await updateDoc('orders', docId, {
      prepTimeMinutes: newPrepTime,
      targetDeliveryTime: newTarget,
      updatedAt: now,
    });

    order.prepTimeMinutes = newPrepTime;
    order.targetDeliveryTime = newTarget;
    order.updatedAt = now;

    // Send push notification to customer informing them of the delay
    const customerUserId = order.customer?.userId || order.userId;
    if (customerUserId) {
      let formattedEta = '';
      try {
        formattedEta = new Date(newTarget).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      } catch (_) {}

      notificationService.sendToUser(customerUserId, {
        title: 'Order Preparation Delay',
        body: `Our butchery counter added +${extraMinutes} mins for fresh cutting. New estimated delivery: ${formattedEta || 'Updated'}.`,
        data: {
          notificationType: 'ORDER_DELAY',
          orderId: order.orderId || id,
          extraMinutes: String(extraMinutes),
          newTargetDeliveryTime: newTarget,
        },
      }).catch((err) => console.warn('[FCM] Delay push error:', err.message));
    }

    emitOrderStatusUpdate(order.orderId || id, order);
    if (docId !== (order.orderId || id)) {
      emitOrderStatusUpdate(docId, order);
    }

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
 * PATCH /api/store-admin/orders/:id/modify-items
 * Modify items, weight, quantity or piece count in an active order
 */
const modifyOrderItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items: newItems, reason } = req.body;

    if (!newItems || !Array.isArray(newItems) || newItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Updated items array cannot be empty.' });
    }

    const order = await getOrderByIdFS(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Guard: Only allow modifications while still in store preparation
    const currentStatus = String(order.status || 'Pending').toLowerCase();
    const allowedStatuses = ['pending', 'cutting', 'ready'];
    if (!allowedStatuses.includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot modify items because order is already in "${order.status}" stage.`,
      });
    }

    const docId = order.id || order._id || id;

    // Authoritative calculation of new items array and subtotal
    let newSubtotal = 0;
    const processedItems = newItems.map((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.itemPrice ?? item.price ?? 0));
      const lineTotal = Math.round(unitPrice * qty);
      newSubtotal += lineTotal;

      return {
        productId: item.productId || item.id || '',
        name: item.name || 'Cut Item',
        price: unitPrice,
        quantity: qty,
        netWeight: item.netWeight || item.weight || '',
        image: item.image || '',
        isModified: Boolean(item.isModified),
        notes: item.notes || '',
      };
    });

    const deliveryFee = Number(order.deliveryFee) || 0;
    const expressFee = Number(order.expressFee) || 0;
    const tip = Number(order.tip || order.tipAmount) || 0;
    const discountAmount = Number(order.discountAmount) || 0;

    const newGrandTotal = Math.max(0, newSubtotal + deliveryFee + expressFee + tip - discountAmount);
    // Preserve true initial amount even across multiple modifications
    const originalAmount = Number(order.originalAmount != null ? order.originalAmount : (order.amount ?? order.totalAmount ?? 0));

    // Build human-readable item summary for KOT and dashboard
    const itemSummary = processedItems
      .map((it) => `${it.name}${it.netWeight ? ` (${it.netWeight})` : ''} ×${it.quantity}`)
      .join(', ');

    const now = new Date().toISOString();
    const updatePayload = {
      items: processedItems,
      itemSummary,
      subtotal: newSubtotal,
      amount: newGrandTotal,
      totalAmount: newGrandTotal,
      isModified: true,
      modifiedAt: now,
      modificationReason: reason || 'Customer requested quantity/weight adjustment on call',
      updatedAt: now,
    };

    // If order was paid online, preserve record of original payment and track extra balance due
    const isOnlinePrepaid = order.paymentStatus === 'Paid' && (
      order.paymentMethod?.toLowerCase().includes('online') ||
      order.paymentMethod?.toLowerCase().includes('payu') ||
      order.paymentMethod?.toLowerCase().includes('razorpay') ||
      order.paymentMethod?.toLowerCase().includes('upi') ||
      order.paymentMethod?.toLowerCase().includes('wallet')
    );

    if (isOnlinePrepaid) {
      const additionalDue = Math.max(0, newGrandTotal - originalAmount);
      updatePayload.originalAmount = originalAmount;
      updatePayload.additionalAmountDue = additionalDue;
      updatePayload.additionalPaymentStatus = additionalDue > 0 ? 'Pending Collection on Delivery' : 'Settled';
    }

    await updateDoc('orders', docId, updatePayload);

    const updatedOrder = {
      ...order,
      ...updatePayload,
    };

    // Notify customer about the order revision
    const customerUserId = order.customer?.userId || order.userId;
    if (customerUserId) {
      notificationService.sendToUser(customerUserId, {
        title: 'Order Items Revised',
        body: `Your order #${order.orderId || id} has been updated. New Total: ₹${newGrandTotal}.`,
        data: {
          notificationType: 'ORDER_MODIFIED',
          orderId: order.orderId || id,
          newAmount: String(newGrandTotal),
        },
      }).catch((err) => console.warn('[FCM] Order modified push error:', err.message));
    }

    // Real-time WebSocket emission to all devices and store room
    emitOrderStatusUpdate(order.orderId || id, updatedOrder);
    if (docId !== (order.orderId || id)) {
      emitOrderStatusUpdate(docId, updatedOrder);
    }

    res.status(200).json({
      success: true,
      message: 'Order items and bill successfully updated.',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

const generateOrderId = () => {
  return 'TEF-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

/**
 * POST /api/store-admin/orders/create-manual
 * Create an order directly by Store Admin (Self / Phone / Walk-in / Direct message)
 */
const createManualOrder = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const {
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      pickupMode,
      fulfillmentType,
      items,
      paymentMethod,
      paymentStatus,
      deliverySlot,
      prepTimeMinutes,
      notes,
    } = req.body;

    if (!customerPhone || typeof customerPhone !== 'string' || customerPhone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Valid 10-digit customer phone number is required',
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order items cannot be empty',
      });
    }

    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
    const finalCustomerName = (customerName || '').trim() || 'Valued Customer';
    const isPickup = Boolean(
      pickupMode === true ||
      fulfillmentType === 'pickup' ||
      (typeof deliverySlot === 'string' && deliverySlot.toLowerCase().includes('pickup'))
    );
    const resolvedFulfillment = isPickup ? 'pickup' : 'delivery';

    // 1. Resolve or register Customer User Profile in Firestore
    let customerUserId = `cust-${cleanPhone}`;
    let existingUser = null;
    const userMatches = await queryDocs('users', (ref) => ref.where('phone', '==', cleanPhone).limit(1));
    if (userMatches && userMatches.length > 0) {
      existingUser = userMatches[0];
      customerUserId = existingUser.id || existingUser._id || customerUserId;
    } else {
      const fullPhoneMatches = await queryDocs('users', (ref) => ref.where('phone', '==', `+91${cleanPhone}`).limit(1));
      if (fullPhoneMatches && fullPhoneMatches.length > 0) {
        existingUser = fullPhoneMatches[0];
        customerUserId = existingUser.id || existingUser._id || customerUserId;
      }
    }

    if (!existingUser) {
      const newUserDoc = {
        id: customerUserId,
        _id: customerUserId,
        name: finalCustomerName,
        phone: cleanPhone,
        email: customerEmail || '',
        role: 'customer',
        walletBalance: 0,
        addresses: isPickup ? [] : [{
          id: `addr-${Date.now()}`,
          tag: 'Delivery Address',
          line1: shippingAddress || 'Ranchi Delivery',
          city: 'Ranchi',
          pincode: '834001',
          isDefault: true,
        }],
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      await createDoc('users', customerUserId, newUserDoc).catch(() => {});
    }

    // 2. Calculate Pricing with Dynamic Store Delivery Fee
    const itemsSubtotal = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );

    // Load store configuration to respect Super Admin delivery fee settings
    const storeDoc = await getStoreById(storeId).catch(() => null) || await getDoc('stores', storeId).catch(() => null);
    const freeThreshold = typeof storeDoc?.freeDeliveryThreshold === 'number' ? storeDoc.freeDeliveryThreshold : 399;
    const storeDeliveryFee = typeof storeDoc?.standardDeliveryFee === 'number' ? storeDoc.standardDeliveryFee : 40;

    let deliveryFee;
    if (isPickup) {
      deliveryFee = 0;
    } else if (req.body.deliveryFee !== undefined && req.body.deliveryFee !== null && req.body.deliveryFee !== '') {
      deliveryFee = Math.max(0, Number(req.body.deliveryFee) || 0);
    } else {
      deliveryFee = itemsSubtotal >= freeThreshold ? 0 : storeDeliveryFee;
    }
    const finalAmount = Math.max(0, itemsSubtotal + deliveryFee);

    // 3. Deduct Store Inventory
    try {
      const storeInv = await getStoreInventory(storeId);
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
      console.warn('[StoreAdmin] Manual order inventory deduction note:', invErr.message);
    }

    // 4. Construct Order Document
    const orderId = generateOrderId();
    const now = new Date().toISOString();
    const prepMinutes = Number(prepTimeMinutes) || 25;
    const initialTransit = isPickup ? 0 : 15;
    const targetDeliveryTime = new Date(Date.now() + (prepMinutes + initialTransit) * 60 * 1000).toISOString();
    const deliveryOtp = isPickup ? null : Math.floor(1000 + Math.random() * 9000).toString();

    const manualInstruction = String(notes || req.body.deliveryInstruction || req.body.instruction || '').trim();

    const orderPayload = {
      id: orderId,
      _id: orderId,
      orderId,
      deliveryOtp,
      deliveryInstruction: manualInstruction || null,
      customer: {
        name: finalCustomerName,
        phone: cleanPhone,
        email: customerEmail || existingUser?.email || '',
        userId: customerUserId,
        address: isPickup ? 'Store Takeaway Counter, Ranchi' : (shippingAddress || 'Ranchi Delivery'),
        deliveryInstruction: manualInstruction || null,
        lat: 23.3512,
        lng: 85.3154,
      },
      items: items.map((i) => ({
        productId: i.productId || i.id || '',
        name: i.name || 'Fresh Meat Cut',
        price: Number(i.price) || 0,
        quantity: Number(i.quantity) || 1,
        netWeight: i.netWeight || i.selectedWeight || i.weight || '500g',
        image: i.image || '',
      })),
      itemSummary: items.map((i) => `${i.name || 'Cut'} ×${i.quantity || 1}`).join(', '),
      amount: finalAmount,
      totalAmount: finalAmount,
      itemsSubtotal,
      deliveryFee,
      expressFee: 0,
      tipAmount: 0,
      discountAmount: 0,
      couponCode: null,
      coupon: null,
      storeId,
      storeName: storeId === 'S004' ? "TeFFe's — Doranda Hub" : "TeFFe's — Kishore Ganj Store",
      deliverySlot: isPickup ? 'Store Pickup (Counter Takeaway)' : (deliverySlot || '90 Mins Express Delivery'),
      fulfillmentType: resolvedFulfillment,
      pickupMode: isPickup,
      prepTimeMinutes: prepMinutes,
      targetDeliveryTime,
      remainingTransitMinutes: initialTransit,
      etaStage: 'PREPARING',
      paymentMethod: paymentMethod || (isPickup ? 'Paid at Store Counter' : 'Cash on Delivery'),
      paymentStatus: paymentStatus || (isPickup ? 'Paid' : 'Pending'),
      status: 'Cutting', // Queued straight into cutting because Store Admin received & accepted it
      createdByType: 'self_store_admin',
      createdByAdminName: req.user?.name || 'Store Admin',
      createdByAdminId: req.user?.id || req.user?._id || 'admin',
      orderSource: 'store_direct',
      notes: notes || 'Created by Store Admin (Self - Direct/Phone)',
      timeline: [
        { status: 'Pending', timestamp: now, note: 'Order created directly by Store Admin (Self)' },
        { status: 'Cutting', timestamp: now, note: 'Order acknowledged and moved to cutting queue' },
      ],
      isInventoryDeducted: true,
      createdAt: now,
      updatedAt: now,
    };

    // Save into Firestore orders collection
    await createDoc('orders', orderId, orderPayload, { overwrite: true });

    // Broadcast socket events so live tables and customer tracking update in real-time
    try {
      emitOrderCreated(orderPayload);
      emitOrderStatusUpdate(orderId, orderPayload);
    } catch (sErr) {
      console.warn('[StoreAdmin] Socket emit warning:', sErr.message);
    }

    // Push notification to customer if they have the app registered
    if (customerUserId) {
      notificationService.sendToUser(customerUserId, {
        title: 'Order Confirmed by Store',
        body: `Your order #${orderId} was placed directly with ${orderPayload.storeName}. Tap to track live prep and delivery!`,
        data: {
          notificationType: 'ORDER_STATUS',
          orderId,
          status: 'Cutting',
          clickAction: `/dashboard?orderId=${orderId}`,
        },
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully by Store Admin (Self)',
      order: orderPayload,
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

    const targetProdId = existing.productId || existing.itemId || id;

    // Keep product catalog inStock status synced
    if (updated && updated.stock !== undefined) {
      (async () => {
        try {
          const { updateDoc, queryDocs } = require('../lib/firestore');
          if (Number(updated.stock) > 0) {
            await updateDoc('products', targetProdId, { inStock: true });
          } else {
            const allStoreInv = await queryDocs('inventory', (ref) =>
              ref.where('itemId', '==', targetProdId)
            );
            const anyInStock = allStoreInv.some((it) => it.storeId !== storeId && Number(it.stock) > 0);
            if (!anyInStock) {
              await updateDoc('products', targetProdId, { inStock: false });
            }
          }
        } catch (_) {}
      })();
    }

    // Notify waiting customers if fresh stock was replenished and is now > 0
    if (updated && Number(updated.stock) > 0) {
      (async () => {
        try {
          const { queryDocs, updateDoc } = require('../lib/firestore');
          const notificationService = require('../services/notificationService');
          const allSubs = await queryDocs('stock_notifications', (ref) =>
            ref.where('productId', '==', targetProdId)
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

    if (result && Number(result.stock) > 0) {
      try {
        const { updateDoc } = require('../lib/firestore');
        await updateDoc('products', itemId, { inStock: true });
      } catch (_) {}
    }

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

    if (sourceClassification === 'fresh' && result && Number(result.remainingSourceStock) <= 0) {
      try {
        const { queryDocs, updateDoc } = require('../lib/firestore');
        const otherStoreInv = await queryDocs('inventory', (ref) =>
          ref.where('itemId', '==', itemId)
        );
        const anyOtherInStock = otherStoreInv.some(
          (inv) => inv.storeId !== storeId && Number(inv.stock) > 0
        );
        if (!anyOtherInStock) {
          await updateDoc('products', itemId, { inStock: false });
        }
      } catch (_) {}
    }

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
      const orderDateMs = parseDateToMillis(o.createdAt) || Date.now();
      const orderDate = new Date(orderDateMs);

      if (!map.has(key)) {
        map.set(key, {
          id: `CUST-${cleanPhone ? cleanPhone.slice(-4) : (o.customer?.userId || '0000')}`,
          name: o.customer?.name || 'Customer',
          phone: cleanPhone ? `+91 ${cleanPhone}` : (rawPhone || 'Unknown'),
          address: o.customer?.address || o.shippingAddress?.address || 'Ranchi',
          orders: 1,
          totalOrders: 1,
          totalSpent: amt,
          lastOrder: formatDDMMYYYY_IST(orderDateMs),
          lastOrderDate: orderDate.toISOString(),
          _lastOrderMs: orderDateMs,
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
        if (orderDateMs >= (entry._lastOrderMs || 0)) {
          entry._lastOrderMs = orderDateMs;
          entry.lastOrderDate = orderDate.toISOString();
          entry.lastOrder = formatDDMMYYYY_IST(orderDateMs);
          if (o.customer?.address || o.shippingAddress?.address) {
            entry.address = o.customer?.address || o.shippingAddress?.address;
          }
        }
      }
    }

    const nowMs = Date.now();
    const customers = Array.from(map.values()).map((c) => {
      const lastMs = c._lastOrderMs || null;
      delete c._lastOrderMs;
      c.totalSpent = Math.round(c.totalSpent * 100) / 100;

      const daysSince = lastMs ? getCalendarDaysSinceOrderIST(lastMs, nowMs) : null;
      c.daysSinceLastOrder = daysSince;

      const count = Number(c.totalOrders || c.orders || 0);
      if (count >= 2) {
        c.segment = (daysSince != null && daysSince <= 30) ? 'active' : 'inactive';
      } else if (count === 1) {
        c.segment = (daysSince != null && daysSince <= 30) ? 'new' : 'inactive';
      } else {
        c.segment = 'new';
      }
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

        const riderActiveCount = activeOrders.filter((o) => {
          const oRiderId = o.rider?.riderId ? String(o.rider.riderId) : '';
          const oRiderPhone = o.rider?.phone ? String(o.rider.phone).replace(/\D/g, '') : '';
          const oRiderName = o.rider?.name ? String(o.rider.name).trim().toLowerCase() : '';
          return (idStr && oRiderId === idStr) || (phoneStr && oRiderPhone === phoneStr) || (nameStr && oRiderName === nameStr);
        }).length;

        const copy = { ...r, activeOrdersCount: riderActiveCount };
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

    res.status(200).json({ success: true, order: updatedOrder || order, rider });
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
 * GET /api/store-admin/schedule
 * List all upcoming/active special operating schedules for this store
 */
const getStoreSchedules = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const store = await getStoreById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }
    const todayIST = getTodayISTDateString(new Date());
    const specialSchedules = store.specialSchedules || {};

    // Sort upcoming schedules by date ascending
    const scheduleList = Object.keys(specialSchedules)
      .filter((dateStr) => dateStr >= todayIST)
      .sort()
      .map((dateStr) => specialSchedules[dateStr]);

    res.status(200).json({
      success: true,
      storeId,
      storeName: store.name,
      normalTimings: store.timings || '08:00 AM - 08:00 PM',
      todayIST,
      todaySchedule: specialSchedules[todayIST] || null,
      upcomingSchedules: scheduleList,
      allSchedules: specialSchedules,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/store-admin/schedule
 * Create or edit a special operating schedule for a given date
 */
const setStoreSchedule = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { date, mode, openTime, closeTime, customerNote } = req.body;

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Valid date in YYYY-MM-DD format is required' });
    }

    const todayIST = getTodayISTDateString(new Date());
    if (date < todayIST) {
      return res.status(400).json({ success: false, message: 'Cannot configure schedule for past dates' });
    }

    const validModes = ['half_day', 'late_opening', 'custom_hours', 'closed'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ success: false, message: `Invalid schedule mode. Must be one of: ${validModes.join(', ')}` });
    }

    const store = await getStoreById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    // Save schedule in store.specialSchedules map (Existing orders continue normal fulfillment; new incoming orders will be scheduled for next day according to cutoff)
    const specialSchedules = { ...(store.specialSchedules || {}) };
    specialSchedules[date] = {
      date,
      mode,
      openTime: (mode === 'late_opening' || mode === 'custom_hours') ? (openTime || '12:00') : '08:00',
      closeTime: (mode === 'half_day' || mode === 'custom_hours') ? (closeTime || '13:00') : '20:00',
      customerNote: (customerNote || '').trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || req.user?.name || 'storeadmin',
    };

    await updateStoreFS(storeId, { specialSchedules });

    res.status(200).json({
      success: true,
      message: `Operating schedule for ${date} updated successfully.`,
      schedule: specialSchedules[date],
      specialSchedules,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/store-admin/schedule/:date
 * Remove a special operating schedule for a given date
 */
const removeStoreSchedule = async (req, res, next) => {
  try {
    const storeId = getEffectiveStoreId(req);
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const store = await getStoreById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const specialSchedules = { ...(store.specialSchedules || {}) };
    delete specialSchedules[date];

    await updateStoreFS(storeId, { specialSchedules });

    res.status(200).json({
      success: true,
      message: `Special schedule for ${date} removed. Store will follow standard operating hours.`,
      specialSchedules,
    });
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
      settings: config,
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
  getStoreSchedules,
  setStoreSchedule,
  removeStoreSchedule,
  getStoreRemittances,
  confirmRemittance,
  collectRiderCash,
  checkBatchFeasibility,
  createDeliveryBatch,
  getStoreBatchSettings,
  updateStoreBatchSettings,
  createManualOrder,
  modifyOrderItems,
};

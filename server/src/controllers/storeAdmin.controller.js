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
} = require('../services/firestore/return.firestore.service');

const {
  getStoreById,
  updateStore: updateStoreFS,
  createStore: createStoreFS,
} = require('../services/firestore/store.firestore.service');

const {
  getStoreRemittances: getStoreRemittancesFS,
  confirmRemittanceTransactional,
} = require('../services/firestore/remittance.firestore.service');

const notificationService = require('../services/notificationService');
const { emitOrderStatusUpdate, emitInventoryUpdate } = require('../socket');

/**
 * Normalizes store ID (maps S002 ↔ S004 for Doranda hub)
 */
const resolveStoreId = (rawStoreId) => {
  if (!rawStoreId) return 'S001';
  const clean = String(rawStoreId).trim();
  return (clean === 'S002' || clean === 'S004') ? 'S004' : clean;
};

/**
 * GET /api/store-admin/dashboard
 * Store Admin KPI summary & latest orders
 */
const getDashboardOverview = async (req, res, next) => {
  try {
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);

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
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);
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

    const updatedResult = await updateOrderStatusFS(id, status, {
      id: req.user?._id || req.user?.id,
      name: req.user?.name || 'Store Admin',
      role: req.user?.role || 'storeadmin',
    });

    const updatedOrder = updatedResult.order || order;
    updatedOrder.status = status;

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
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);
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
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);
    const { id } = req.params;
    const { stock, defreezeStock, min, reason } = req.body;

    const updates = {};
    if (stock !== undefined) updates.stock = Math.max(0, Number(stock));
    if (defreezeStock !== undefined) updates.defreezeStock = Math.max(0, Number(defreezeStock));
    if (min !== undefined) updates.min = Math.max(0, Number(min));
    updates.lastRestocked = `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const updated = await updateInventoryItemFS(storeId, id, updates);

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
    const rawStoreId = req.user?.storeId || req.body.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);
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
    const rawStoreId = req.user?.storeId || req.body.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);
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
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);
    const { itemId, actionType, classification, search, page = 1, limit = 50 } = req.query;

    let history = await getInventoryHistoryFS(storeId);

    if (itemId) {
      history = history.filter((h) => h.itemId === itemId);
    }
    if (actionType && actionType !== 'all') {
      history = history.filter((h) => h.actionType === actionType);
    }
    if (classification && classification !== 'all') {
      history = history.filter(
        (h) =>
          h.classification === classification ||
          h.sourceClassification === classification ||
          h.destinationClassification === classification
      );
    }
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      history = history.filter(
        (h) =>
          (h.productName && h.productName.toLowerCase().includes(s)) ||
          (h.reason && h.reason.toLowerCase().includes(s)) ||
          (h.orderId && h.orderId.toLowerCase().includes(s))
      );
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    const paginated = history.slice(skip, skip + limitNum);

    res.status(200).json({
      success: true,
      total: history.length,
      page: pageNum,
      totalPages: Math.ceil(history.length / limitNum),
      count: paginated.length,
      history: paginated,
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
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);

    const orders = await getStoreOrders(storeId);
    const map = new Map();

    for (const o of orders) {
      const phone = o.customer?.phone || 'Unknown';
      if (!map.has(phone)) {
        map.set(phone, {
          id: `CUST-${phone.slice(-4)}`,
          name: o.customer?.name || 'Customer',
          phone: phone,
          address: o.customer?.address || o.shippingAddress?.address || 'Ranchi',
          orders: 1,
          totalSpent: Number(o.amount) || 0,
          lastOrder: o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'Today',
        });
      } else {
        const entry = map.get(phone);
        entry.orders += 1;
        entry.totalSpent += Number(o.amount) || 0;
      }
    }

    const customers = Array.from(map.values());
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
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);
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
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);
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
 * GET /api/store-admin/riders
 * Get riders for this store
 */
const getRiders = async (req, res, next) => {
  try {
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);

    const allRiders = await queryDocs('users', (ref) => ref.where('role', '==', 'rider'));
    let storeRiders = allRiders.filter(
      (r) => !r.storeId || resolveStoreId(r.storeId) === storeId
    );
    if (storeRiders.length === 0) storeRiders = allRiders;

    const orders = await getStoreOrders(storeId);
    const activeOrders = orders.filter((o) => o.status === 'Out for Delivery');

    const activeRiderIdentifiers = new Set();
    activeOrders.forEach((o) => {
      if (o.rider?.riderId) activeRiderIdentifiers.add(String(o.rider.riderId));
      if (o.rider?.phone) activeRiderIdentifiers.add(String(o.rider.phone).replace(/\D/g, ''));
      if (o.rider?.name) activeRiderIdentifiers.add(String(o.rider.name).trim().toLowerCase());
    });

    const updatedRiders = await Promise.all(
      storeRiders.map(async (r) => {
        const idStr = r._id ? r._id.toString() : (r.id || '');
        const phoneStr = (r.phone || '').replace(/\D/g, '');
        const nameStr = (r.name || '').trim().toLowerCase();

        const isOnDelivery =
          activeRiderIdentifiers.has(idStr) ||
          (phoneStr && activeRiderIdentifiers.has(phoneStr)) ||
          (nameStr && activeRiderIdentifiers.has(nameStr));

        const copy = { ...r };
        delete copy.password;

        if (isOnDelivery && r.riderStatus !== 'On Delivery') {
          await updateDoc('users', idStr, { riderStatus: 'On Delivery' });
          copy.riderStatus = 'On Delivery';
        } else if (!isOnDelivery && r.riderStatus === 'On Delivery') {
          await updateDoc('users', idStr, { riderStatus: 'Available' });
          copy.riderStatus = 'Available';
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

    const riderInfo = {
      riderId: rider.id || riderId,
      name: rider.name,
      phone: rider.phone,
      vehicleNumber: rider.vehicleNumber || 'JH01-EC-1234',
      lat: 23.3441,
      lng: 85.3096,
    };

    await updateDoc('orders', id, {
      status: 'Out for Delivery',
      rider: riderInfo,
      updatedAt: new Date().toISOString(),
    });

    await updateDoc('users', riderId, {
      riderStatus: 'On Delivery',
      updatedAt: new Date().toISOString(),
    });

    order.status = 'Out for Delivery';
    order.rider = riderInfo;

    emitOrderStatusUpdate(order.orderId || id, order);

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
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);
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
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);

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
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = resolveStoreId(rawStoreId);
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
  getRiders,
  assignRiderToOrder,
  getStoreStatus,
  updateStoreStatus,
  getStoreRemittances,
  confirmRemittance,
};

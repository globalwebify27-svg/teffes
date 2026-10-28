const Order = require('../models/Order');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const InventoryHistory = require('../models/InventoryHistory');
const DeliverySlot = require('../models/DeliverySlot');
const ReturnRequest = require('../models/ReturnRequest');
const User = require('../models/User');
const Store = require('../models/Store');
const Remittance = require('../models/Remittance');
const notificationService = require('../services/notificationService');
const inventoryService = require('../services/inventoryService');
const { emitOrderStatusUpdate } = require('../socket');
const {
  getStoreOrders,
  updateOrderStatus: updateOrderStatusFirestore,
  getOrderById: getOrderByIdFirestore,
} = require('../services/firestore/order.firestore.service');

/**
 * GET /api/store-admin/dashboard
 * Store Admin KPI summary & latest orders
 */
const getDashboardOverview = async (req, res, next) => {
  try {
    const rawStoreId = req.user?.storeId || req.query.storeId || 'S001';
    const storeId = (rawStoreId === 'S002' || rawStoreId === 'S004') ? 'S004' : rawStoreId;

    let fsOrders = [];
    try {
      fsOrders = await getStoreOrders(storeId);
    } catch (_) {}

    const storeIds = (storeId === 'S004' || storeId === 'S002') ? ['S004', 'S002'] : [storeId];
    const [
      mongoPendingCount,
      mongoDeliveredTodayCount,
      mongoTotalOrders,
      mongoOrders,
      chickenInventory,
      muttonInventory,
      activeRidersCount,
    ] = await Promise.all([
      Order.countDocuments({ storeId: { $in: storeIds }, status: { $in: ['Pending', 'Cutting'] } }),
      Order.countDocuments({ storeId: { $in: storeIds }, status: 'Delivered' }),
      Order.countDocuments({ storeId: { $in: storeIds } }),
      Order.find({ storeId: { $in: storeIds } }).sort({ createdAt: -1 }).limit(5),
      Inventory.findOne({ storeId, category: 'Chicken', itemId: 'INV-001' }),
      Inventory.findOne({ storeId, category: 'Mutton', itemId: 'INV-005' }),
      User.countDocuments({ role: 'rider', isActive: true }),
    ]);

    const hasFsOrders = fsOrders && fsOrders.length > 0;
    const pendingCount = hasFsOrders
      ? fsOrders.filter((o) => ['Pending', 'Cutting'].includes(o.status)).length
      : mongoPendingCount;
    const deliveredTodayCount = hasFsOrders
      ? fsOrders.filter((o) => o.status === 'Delivered').length
      : mongoDeliveredTodayCount;
    const totalOrders = hasFsOrders ? fsOrders.length : mongoTotalOrders;
    const orders = hasFsOrders ? fsOrders.slice(0, 5) : mongoOrders;

    // Calculate revenue
    const deliveredOrders = hasFsOrders
      ? fsOrders.filter((o) => o.status === 'Delivered')
      : await Order.find({ storeId: { $in: storeIds }, status: 'Delivered' });
    const todayRevenue = deliveredOrders.reduce((acc, curr) => acc + (curr.amount || curr.totalAmount || 0), 0);

    const kpis = [
      {
        icon: 'inventory_2',
        label: 'Pending Orders',
        value: `${pendingCount}`,
        sub: 'Awaiting cutting or dispatch',
        color: '#941717',
        tab: 'orders',
      },
      {
        icon: 'check_circle',
        label: 'Delivered Today',
        value: `${deliveredTodayCount}`,
        sub: 'Successfully completed',
        color: '#059669',
        tab: 'orders',
      },
      {
        icon: 'payments',
        label: "Today's Revenue",
        value: `₹${todayRevenue.toLocaleString('en-IN')}`,
        sub: `From ${deliveredTodayCount} completed orders`,
        color: '#c28114',
        tab: 'orders',
      },
      {
        icon: 'restaurant',
        label: 'Chicken Stock',
        value: chickenInventory ? `${chickenInventory.stock} kg` : '98 kg',
        sub: 'Fresh morning batch',
        color: '#7c3aed',
        tab: 'inventory',
      },
      {
        icon: 'kebab_dining',
        label: 'Mutton Stock',
        value: muttonInventory ? `${muttonInventory.stock} kg` : '42 kg',
        sub: 'Young goat — low, reorder soon',
        color: '#d97706',
        tab: 'inventory',
      },
      {
        icon: 'two_wheeler',
        label: 'Active Riders',
        value: `${activeRidersCount || 4}`,
        sub: '2 on delivery, 2 available',
        color: '#0284c7',
        tab: 'riders',
      },
    ];

    res.status(200).json({
      success: true,
      storeId,
      kpis,
      latestOrders: orders,
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
    const storeId = (rawStoreId === 'S002' || rawStoreId === 'S004') ? 'S004' : rawStoreId;
    const { status } = req.query;

    // 1. Fetch from Firestore (Production primary data store)
    try {
      const firestoreOrders = await getStoreOrders(storeId, status);
      if (firestoreOrders && firestoreOrders.length > 0) {
        return res.status(200).json({
          success: true,
          count: firestoreOrders.length,
          orders: firestoreOrders,
        });
      }
    } catch (fsErr) {
      console.warn('[storeAdmin] Firestore getStoreOrders fallback:', fsErr.message);
    }

    // 2. Fallback to MongoDB if Firestore has no records
    const storeIds = (storeId === 'S004' || storeId === 'S002') ? ['S004', 'S002'] : [storeId];
    const query = { storeId: { $in: storeIds } };
    if (status && status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

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

    // 1. Attempt Firestore update first
    try {
      const fsOrder = await getOrderByIdFirestore(id);
      if (fsOrder) {
        const updated = await updateOrderStatusFirestore(id, status, {
          id: req.user?._id || req.user?.id,
          name: req.user?.name || 'Store Admin',
          role: req.user?.role || 'storeadmin',
        });
        emitOrderStatusUpdate(id, { orderId: id, status, storeId: fsOrder.storeId });
        return res.status(200).json({
          success: true,
          message: `Order status advanced to ${status}`,
          order: updated?.order || fsOrder,
        });
      }
    } catch (fsErr) {
      console.warn('[storeAdmin] Firestore updateOrderStatus fallback:', fsErr.message);
    }

    // 2. Fallback to MongoDB
    const order = await Order.findOne({
      $or: [{ orderId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const wasDelivered = order.status === 'Delivered';
    order.status = status;

    // If advancing order to Cutting or beyond and inventory wasn't deducted yet, validate and deduct from Fresh Inventory
    if (['Cutting', 'Ready', 'Out for Delivery', 'Delivered'].includes(status) && !order.isInventoryDeducted) {
      const deduction = await inventoryService.validateAndDeductInventory(order.storeId, order.items, order.orderId, {
        userId: req.user?._id,
        name: req.user?.name || 'Store Admin',
        role: req.user?.role || 'storeadmin',
        email: req.user?.email || '',
      });
      if (!deduction.success) {
        return res.status(400).json({
          success: false,
          message: deduction.message || 'Cannot advance order: insufficient Fresh Inventory.',
        });
      }
      order.isInventoryDeducted = true;
    }

    // If order was cancelled and inventory was deducted, restore inventory to store
    if (status === 'Cancelled' && order.isInventoryDeducted && !order.isInventoryRestocked) {
      await inventoryService.restoreOrderInventory(order, {
        userId: req.user?._id,
        name: req.user?.name || 'Store Admin',
        role: req.user?.role || 'storeadmin',
        email: req.user?.email || '',
      }).catch((err) => console.error('[StoreAdmin] Inventory restore error:', err.message));
    }

    await order.save();

    // Update loyalty tier if just delivered
    if (status === 'Delivered' && !wasDelivered && order.customer && order.customer.userId) {
      const User = require('../models/User');
      const user = await User.findById(order.customer.userId);
      if (user) {
        user.totalSpent = (user.totalSpent || 0) + order.amount;
        // Evaluate Tier
        if (user.totalSpent >= 20000) user.loyaltyTier = 'Platinum';
        else if (user.totalSpent >= 10000) user.loyaltyTier = 'Gold';
        else if (user.totalSpent >= 3000) user.loyaltyTier = 'Silver';
        else user.loyaltyTier = 'Bronze';
        await user.save();
      }
    }

    emitOrderStatusUpdate(order.orderId, order);

    // Send push notification to customer on status update
    if (order.customer && order.customer.userId) {
      const titles = {
        Cutting: 'Meat Cutting Started',
        Ready: order.fulfillmentType === 'pickup' ? 'Order Ready for Pickup' : 'Order Packed & Ready',
        'Out for Delivery': 'Out for Delivery',
        Delivered: 'Order Delivered',
        Cancelled: 'Order Cancelled',
      };
      const bodies = {
        Cutting: `Our team is preparing your fresh cuts for order #${order.orderId}.`,
        Ready: order.fulfillmentType === 'pickup'
          ? `Your order #${order.orderId} is packed and ready for takeaway at the store counter.`
          : `Order #${order.orderId} is packed and awaiting rider dispatch.`,
        'Out for Delivery': `Your order #${order.orderId} is on the way to your address!`,
        Delivered: `Your order #${order.orderId} has been delivered. Thank you for choosing Teffe's!`,
        Cancelled: `Your order #${order.orderId} has been cancelled.`,
      };

      if (titles[status]) {
        notificationService.sendToUser(order.customer.userId, {
          title: titles[status],
          body: bodies[status],
          data: {
            notificationType: 'ORDER_STATUS',
            orderId: order.orderId,
            status: order.status,
            clickAction: `/dashboard?orderId=${order.orderId}`,
          },
        }).catch((err) => console.warn('[FCM] Status notification error:', err.message));
      }
    }

    res.status(200).json({ success: true, order });
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
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    const inventory = await Inventory.find({ storeId }).sort({ category: 1, item: 1 });

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
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    const { id } = req.params;
    const { stock, defreezeStock, min, classification, operation, quantity, reason } = req.body;

    if (classification || operation || quantity !== undefined) {
      const result = await inventoryService.adjustStockItem({
        storeId,
        itemId: id,
        classification: classification || 'fresh',
        operation: operation || 'set',
        quantity: quantity !== undefined ? quantity : stock,
        min,
        reason,
        user: req.user,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.status(200).json(result);
    }

    const item = await Inventory.findOne({
      storeId,
      $or: [{ itemId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const prevStock = item.stock;
    if (stock !== undefined) item.stock = Math.max(0, Number(stock));
    if (defreezeStock !== undefined) item.defreezeStock = Math.max(0, Number(defreezeStock));
    if (min !== undefined) item.min = Math.max(0, Number(min));
    item.lastRestocked = `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    await item.save();

    if (stock !== undefined && stock !== prevStock) {
      try {
        await InventoryHistory.create({
          storeId: item.storeId,
          itemId: item.itemId,
          productName: item.item,
          category: item.category || '',
          classification: 'fresh',
          actionType: 'set_stock',
          quantity: Math.abs(item.stock - prevStock),
          unit: item.unit || 'kg',
          previousQuantity: prevStock,
          resultingQuantity: item.stock,
          sourceClassification: 'fresh',
          destinationClassification: null,
          reason: reason || 'Manual stock update',
          actor: req.user ? {
            userId: req.user._id,
            name: req.user.name || 'Store Admin',
            role: req.user.role || 'storeadmin',
            email: req.user.email || '',
          } : { name: 'Store Admin', role: 'storeadmin' },
        });
      } catch (histErr) {
        console.warn('[StoreAdmin] History log error:', histErr.message);
      }
    }

    try {
      const { emitInventoryUpdate } = require('../socket');
      emitInventoryUpdate(item.storeId, [item]);
    } catch (socketErr) {
      console.warn('[StoreAdmin] Inventory socket emission warning:', socketErr.message);
    }

    res.status(200).json({ success: true, item });
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
    const storeId = req.user?.storeId || req.body.storeId || 'S001';
    const { itemId, quantity, notes } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Item ID is required.' });
    }

    const result = await inventoryService.transferDefreezeToFresh({
      storeId,
      itemId,
      quantity,
      user: req.user,
      notes,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
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
    const storeId = req.user?.storeId || req.body.storeId || 'S001';
    const { itemId, sourceClassification, quantity, reason, notes } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Item ID is required.' });
    }

    const result = await inventoryService.recordDamageWaste({
      storeId,
      itemId,
      sourceClassification: sourceClassification || 'fresh',
      quantity,
      reason,
      notes,
      user: req.user,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
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
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    const { itemId, actionType, classification, search, page = 1, limit = 50 } = req.query;

    const query = { storeId };

    if (itemId) {
      query.itemId = itemId;
    }

    if (actionType && actionType !== 'all') {
      query.actionType = actionType;
    }

    if (classification && classification !== 'all') {
      query.$or = [
        { classification },
        { sourceClassification: classification },
        { destinationClassification: classification },
      ];
    }

    if (search && search.trim()) {
      const s = search.trim();
      const regex = new RegExp(s, 'i');
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { productName: regex },
            { reason: regex },
            { notes: regex },
            { orderId: regex },
          ],
        },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, history] = await Promise.all([
      InventoryHistory.countDocuments(query),
      InventoryHistory.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      count: history.length,
      history,
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
    const storeId = req.user?.storeId || req.query.storeId || 'S001';

    // Group orders by customer phone
    const orders = await Order.find({ storeId }).sort({ createdAt: -1 });
    const map = new Map();

    for (const o of orders) {
      const phone = o.customer?.phone || 'Unknown';
      if (!map.has(phone)) {
        map.set(phone, {
          id: `CUST-${phone.slice(-4)}`,
          name: o.customer?.name || 'Customer',
          phone: phone,
          address: o.customer?.address || 'Ranchi',
          orders: 1,
          totalSpent: o.amount || 0,
          lastOrder: o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'Today',
        });
      } else {
        const entry = map.get(phone);
        entry.orders += 1;
        entry.totalSpent += o.amount || 0;
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
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    const slots = await DeliverySlot.find({ storeId });

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
    const slot = await DeliverySlot.findByIdAndUpdate(id, req.body, { new: true });
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }
    res.status(200).json({ success: true, slot });
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
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    const returns = await ReturnRequest.find({ storeId }).sort({ createdAt: -1 });

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
    const { status } = req.body;

    const returnReq = await ReturnRequest.findOneAndUpdate(
      { $or: [{ requestId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      { status },
      { new: true }
    );

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Return request not found' });
    }

    res.status(200).json({ success: true, returnRequest: returnReq });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/riders
 * Get riders for this store (or all active fleet riders in Ranchi if not assigned specifically)
 */
const getRiders = async (req, res, next) => {
  try {
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    let riders = await User.find({
      role: 'rider',
      $or: [{ storeId }, { storeId: { $exists: false } }, { storeId: null }, { storeId: '' }],
    }).select('-password').lean();

    // Fallback: If no rider has been tagged to this storeId yet, show all active riders in the city pool
    if (riders.length === 0) {
      riders = await User.find({ role: 'rider' }).select('-password').lean();
    }

    // Live verification: Check active "Out for Delivery" orders to guarantee 100% real-time status
    const activeOrders = await Order.find({
      status: 'Out for Delivery',
    }).select('rider status');

    const activeRiderIdentifiers = new Set();
    activeOrders.forEach((o) => {
      if (o.rider?.riderId) activeRiderIdentifiers.add(o.rider.riderId.toString());
      if (o.rider?.phone) activeRiderIdentifiers.add(o.rider.phone.replace(/\D/g, ''));
      if (o.rider?.name) activeRiderIdentifiers.add(o.rider.name.trim().toLowerCase());
    });

    const updatedRiders = await Promise.all(
      riders.map(async (r) => {
        const idStr = r._id ? r._id.toString() : '';
        const phoneStr = (r.phone || '').replace(/\D/g, '');
        const nameStr = (r.name || '').trim().toLowerCase();

        const isOnDelivery =
          activeRiderIdentifiers.has(idStr) ||
          (phoneStr && activeRiderIdentifiers.has(phoneStr)) ||
          (nameStr && activeRiderIdentifiers.has(nameStr));

        if (isOnDelivery && r.riderStatus !== 'On Delivery') {
          // Sync DB record so rider profile and mobile app are also in sync
          await User.updateOne({ _id: r._id }, { riderStatus: 'On Delivery' });
          return { ...r, riderStatus: 'On Delivery' };
        } else if (!isOnDelivery && r.riderStatus === 'On Delivery') {
          // If no active orders exist, free the rider back to Available (unless Offline)
          await User.updateOne({ _id: r._id }, { riderStatus: 'Available' });
          return { ...r, riderStatus: 'Available' };
        }
        return r;
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
    
    const rider = await User.findById(riderId);
    if (!rider || rider.role !== 'rider') {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }

    const order = await Order.findOneAndUpdate(
      { $or: [{ orderId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      { 
        status: 'Out for Delivery',
        rider: {
          riderId: rider._id,
          name: rider.name,
          phone: rider.phone,
          vehicleNumber: rider.vehicleNumber,
          lat: 23.3441,
          lng: 85.3096
        }
      },
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    rider.riderStatus = 'On Delivery';
    await rider.save();
    
    emitOrderStatusUpdate(order.orderId, order);

    // Push notification to rider for new assignment
    notificationService.sendToRider(rider._id, {
      title: 'New Delivery Assignment',
      body: `Order #${order.orderId} assigned to you. Deliver to ${order.customer?.name || 'Customer'}.`,
      data: {
        notificationType: 'DELIVERY_ASSIGNMENT',
        orderId: order.orderId,
        clickAction: `/rider/orders/${order.orderId}`,
      },
    }).catch((err) => console.warn('[FCM] Rider assignment push error:', err.message));

    // Push notification to customer that rider is assigned
    if (order.customer && order.customer.userId) {
      notificationService.sendToUser(order.customer.userId, {
        title: 'Rider Assigned',
        body: `${rider.name} has been assigned to deliver your order #${order.orderId}.`,
        data: {
          notificationType: 'ORDER_STATUS',
          orderId: order.orderId,
          status: 'Out for Delivery',
          clickAction: `/dashboard?orderId=${order.orderId}`,
        },
      }).catch((err) => console.warn('[FCM] Customer rider push error:', err.message));
    }

    res.status(200).json({ success: true, order, rider });
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

    const order = await Order.findOne({
      $or: [{ orderId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.prepTimeMinutes = (order.prepTimeMinutes || 25) + extraMinutes;

    // Recalculate target arrival clock time
    const currentTarget = order.targetDeliveryTime ? new Date(order.targetDeliveryTime).getTime() : Date.now();
    order.targetDeliveryTime = new Date(currentTarget + extraMinutes * 60 * 1000);

    await order.save();
    emitOrderStatusUpdate(order.orderId, order);

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
 * GET /api/store-admin/store-status
 * Retrieve operational hours and live online/paused status
 */
const getStoreStatus = async (req, res, next) => {
  try {
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    let store = await Store.findOne({ storeId });
    if (!store) {
      store = await Store.create({
        storeId,
        name: 'Kishore Ganj Store',
        city: 'Ranchi',
        address: 'Harmu Road, Kishore Ganj, Ranchi, Jharkhand 834001',
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
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    const { isOpen, emergencyNotice, timings, pickupEnabled, deliveryEnabled } = req.body;
    const updateData = {};
    if (typeof isOpen === 'boolean') updateData.isOpen = isOpen;
    if (emergencyNotice !== undefined) updateData.emergencyNotice = emergencyNotice;
    if (timings !== undefined) updateData.timings = timings;
    if (typeof pickupEnabled === 'boolean') updateData.pickupEnabled = pickupEnabled;
    if (typeof deliveryEnabled === 'boolean') updateData.deliveryEnabled = deliveryEnabled;

    // Support Store Admin delivery fees & thresholds
    if (req.body.freeDeliveryThreshold !== undefined && !isNaN(Number(req.body.freeDeliveryThreshold))) {
      updateData.freeDeliveryThreshold = Math.max(0, Number(req.body.freeDeliveryThreshold));
    }
    if (req.body.standardDeliveryFee !== undefined && !isNaN(Number(req.body.standardDeliveryFee))) {
      updateData.standardDeliveryFee = Math.max(0, Number(req.body.standardDeliveryFee));
    }
    if (req.body.expressDeliveryFee !== undefined && !isNaN(Number(req.body.expressDeliveryFee))) {
      updateData.expressDeliveryFee = Math.max(0, Number(req.body.expressDeliveryFee));
    }
    if (typeof req.body.expressDeliveryEnabled === 'boolean') {
      updateData.expressDeliveryEnabled = req.body.expressDeliveryEnabled;
    }
    if (typeof req.body.rainSurgeEnabled === 'boolean') {
      updateData.rainSurgeEnabled = req.body.rainSurgeEnabled;
    }
    if (req.body.rainSurgeFee !== undefined && !isNaN(Number(req.body.rainSurgeFee))) {
      updateData.rainSurgeFee = Math.max(0, Number(req.body.rainSurgeFee));
    }
    if (req.body.freeGiftThreshold !== undefined && !isNaN(Number(req.body.freeGiftThreshold))) {
      updateData.freeGiftThreshold = Math.max(0, Number(req.body.freeGiftThreshold));
    }
    if (typeof req.body.freeGiftName === 'string') {
      updateData.freeGiftName = req.body.freeGiftName.trim();
    }
    if (req.body.deliveryRadiusKm !== undefined && !isNaN(Number(req.body.deliveryRadiusKm))) {
      updateData.deliveryRadiusKm = Math.max(1, Number(req.body.deliveryRadiusKm));
    }
    if (req.body.defaultRiderDailyTarget !== undefined && !isNaN(Number(req.body.defaultRiderDailyTarget))) {
      updateData.defaultRiderDailyTarget = Math.max(1, Number(req.body.defaultRiderDailyTarget));
    }

    // Support updating rider payout & surge incentive settings
    if (req.body.riderPayoutSettings && typeof req.body.riderPayoutSettings === 'object') {
      const { baseDeliveryPay, distanceIncentive, peakHourSurge } = req.body.riderPayoutSettings;
      if (baseDeliveryPay !== undefined && !isNaN(Number(baseDeliveryPay))) {
        updateData['riderPayoutSettings.baseDeliveryPay'] = Math.max(0, Number(baseDeliveryPay));
      }
      if (distanceIncentive !== undefined && !isNaN(Number(distanceIncentive))) {
        updateData['riderPayoutSettings.distanceIncentive'] = Math.max(0, Number(distanceIncentive));
      }
      if (peakHourSurge !== undefined && !isNaN(Number(peakHourSurge))) {
        updateData['riderPayoutSettings.peakHourSurge'] = Math.max(0, Number(peakHourSurge));
      }
    } else {
      if (req.body.baseDeliveryPay !== undefined && !isNaN(Number(req.body.baseDeliveryPay))) {
        updateData['riderPayoutSettings.baseDeliveryPay'] = Math.max(0, Number(req.body.baseDeliveryPay));
      }
      if (req.body.distanceIncentive !== undefined && !isNaN(Number(req.body.distanceIncentive))) {
        updateData['riderPayoutSettings.distanceIncentive'] = Math.max(0, Number(req.body.distanceIncentive));
      }
      if (req.body.peakHourSurge !== undefined && !isNaN(Number(req.body.peakHourSurge))) {
        updateData['riderPayoutSettings.peakHourSurge'] = Math.max(0, Number(req.body.peakHourSurge));
      }
    }

    const store = await Store.findOneAndUpdate(
      { storeId },
      { $set: updateData },
      { new: true, upsert: true }
    );
    res.status(200).json({ success: true, store });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store-admin/remittances
 * List all cash remittance requests for this dark store
 */
const getStoreRemittances = async (req, res, next) => {
  try {
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    const remittances = await Remittance.find({ storeId }).sort({ createdAt: -1 });
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
    const remittance = await Remittance.findOne({
      $or: [{ remittanceId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!remittance) {
      return res.status(404).json({ success: false, message: 'Remittance record not found' });
    }

    remittance.status = 'Confirmed';
    remittance.confirmedBy = req.user._id;
    remittance.confirmedByName = req.user.name || 'Store Admin';
    remittance.confirmedAt = new Date();
    await remittance.save();

    // Also notify rider via RiderNotification
    const RiderNotification = require('../models/RiderNotification');
    await RiderNotification.create({
      riderId: remittance.riderId,
      title: 'Cash Remittance Confirmed',
      body: `Hub closing counter confirmed deposit of ₹${remittance.amount.toFixed(2)} (${remittance.remittanceId}).`,
      type: 'HUB_ALERT',
      data: { remittanceId: remittance.remittanceId },
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: `Cash remittance of ₹${remittance.amount.toFixed(2)} confirmed successfully.`,
      remittance,
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

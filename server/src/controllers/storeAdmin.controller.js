const Order = require('../models/Order');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const DeliverySlot = require('../models/DeliverySlot');
const ReturnRequest = require('../models/ReturnRequest');
const User = require('../models/User');
const { emitOrderStatusUpdate } = require('../socket');

/**
 * GET /api/store-admin/dashboard
 * Store Admin KPI summary & latest orders
 */
const getDashboardOverview = async (req, res, next) => {
  try {
    const storeId = req.user?.storeId || req.query.storeId || 'S001';

    const [
      pendingCount,
      deliveredTodayCount,
      totalOrders,
      orders,
      chickenInventory,
      muttonInventory,
      activeRidersCount,
    ] = await Promise.all([
      Order.countDocuments({ storeId, status: { $in: ['Pending', 'Cutting'] } }),
      Order.countDocuments({ storeId, status: 'Delivered' }),
      Order.countDocuments({ storeId }),
      Order.find({ storeId }).sort({ createdAt: -1 }).limit(5),
      Inventory.findOne({ storeId, category: 'Chicken', itemId: 'INV-001' }),
      Inventory.findOne({ storeId, category: 'Mutton', itemId: 'INV-005' }),
      User.countDocuments({ role: 'rider', isActive: true }),
    ]);

    // Calculate revenue
    const deliveredOrders = await Order.find({ storeId, status: 'Delivered' });
    const todayRevenue = deliveredOrders.reduce((acc, curr) => acc + (curr.amount || 0), 0);

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
        tab: 'slots',
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
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    const { status } = req.query;

    const query = { storeId };
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

    const order = await Order.findOne({
      $or: [{ orderId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const wasDelivered = order.status === 'Delivered';
    order.status = status;
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
 * Update stock kg or minimum threshold
 */
const updateInventoryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stock, min } = req.body;

    const item = await Inventory.findOne({
      $or: [{ itemId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (stock !== undefined) item.stock = stock;
    if (min !== undefined) item.min = min;
    item.lastRestocked = `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    await item.save();

    res.status(200).json({ success: true, item });
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
 * Get riders for this store
 */
const getRiders = async (req, res, next) => {
  try {
    const storeId = req.user?.storeId || req.query.storeId || 'S001';
    const riders = await User.find({ role: 'rider', storeId }).select('-password');
    res.status(200).json({ success: true, count: riders.length, riders });
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

    res.status(200).json({ success: true, order, rider });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardOverview,
  getOrders,
  updateOrderStatus,
  getInventory,
  updateInventoryItem,
  getStoreCustomers,
  getDeliverySlots,
  updateDeliverySlot,
  getReturnRequests,
  updateReturnStatus,
  getRiders,
  assignRiderToOrder,
};

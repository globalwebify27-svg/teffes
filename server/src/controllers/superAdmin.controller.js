const Order = require('../models/Order');
const Store = require('../models/Store');
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');

/**
 * GET /api/super-admin/dashboard
 * Platform-wide KPIs & recent activity log
 */
const getPlatformDashboard = async (req, res, next) => {
  try {
    const [
      totalOrdersToday,
      orders,
      activeStoresCount,
      activeRidersCount,
      totalCustomersCount,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.find().sort({ createdAt: -1 }).limit(10),
      Store.countDocuments({ status: 'Active' }),
      User.countDocuments({ role: 'rider', isActive: true }),
      User.countDocuments({ role: 'customer' }),
    ]);

    const deliveredOrders = await Order.find({ status: 'Delivered' });
    const todayRevenue = deliveredOrders.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const kpis = [
      {
        icon: 'inventory_2',
        label: 'Total Orders Today',
        value: `${totalOrdersToday}`,
        sub: '↑ 18% vs yesterday',
        color: '#941717',
      },
      {
        icon: 'payments',
        label: 'Revenue Today',
        value: `₹${todayRevenue.toLocaleString('en-IN')}`,
        sub: `Across ${activeStoresCount} active stores`,
        color: '#c28114',
      },
      {
        icon: 'storefront',
        label: 'Active Stores',
        value: `${activeStoresCount}`,
        sub: 'Ranchi Kishore Ganj, Doranda',
        color: '#059669',
      },
      {
        icon: 'two_wheeler',
        label: 'Active Riders',
        value: `${activeRidersCount || 8}`,
        sub: '4 out for delivery',
        color: '#7c3aed',
      },
      {
        icon: 'group',
        label: 'Total Customers',
        value: `${totalCustomersCount || 2841}`,
        sub: '↑ 34 new today',
        color: '#0284c7',
      },
      {
        icon: 'star',
        label: 'Avg Rating',
        value: '4.8 / 5',
        sub: 'Based on 1,240 reviews',
        color: '#d97706',
      },
    ];

    // Build recent platform activities
    const recentActivity = orders.map((o) => ({
      time: o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
      event: `Order #${o.orderId} ${o.status.toLowerCase()} for ${o.customer?.name}`,
      store: o.storeName || 'Kishore Ganj',
      status: o.status,
    }));

    res.status(200).json({
      success: true,
      kpis,
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/super-admin/stores
 * List stores
 */
const getStores = async (req, res, next) => {
  try {
    const stores = await Store.find().sort({ storeId: 1 });
    res.status(200).json({ success: true, count: stores.length, stores });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/super-admin/stores
 * Add a new store branch
 */
const createStore = async (req, res, next) => {
  try {
    const store = await Store.create(req.body);
    res.status(201).json({ success: true, store });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/super-admin/stores/:id
 * Update a store
 */
const updateStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const store = await Store.findOneAndUpdate(
      { $or: [{ storeId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      req.body,
      { new: true }
    );
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }
    res.status(200).json({ success: true, store });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/super-admin/stores/:id
 * Delete a store
 */
const deleteStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const store = await Store.findOneAndDelete(
      { $or: [{ storeId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] }
    );
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }
    res.status(200).json({ success: true, message: 'Store deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/super-admin/store-admins
 * List store admins
 */
const getStoreAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: 'storeadmin' }).select('-password');
    res.status(200).json({ success: true, count: admins.length, admins });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/super-admin/store-admins
 * Create or assign a store admin account
 */
const createStoreAdmin = async (req, res, next) => {
  try {
    let { name, email, password, phone, storeId } = req.body;
    
    if (!name || !email || !storeId) {
      return res.status(400).json({ success: false, message: 'Name, email, and store are required' });
    }

    if (phone) {
      phone = phone.replace(/[\s\-()]/g, '');
      if (phone.startsWith('0')) phone = phone.substring(1);
      if (!phone.startsWith('+') && phone.length === 10) phone = '+91' + phone;
    }

    const store = await Store.findOne({ storeId });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        ...(phone ? [{ phone }] : []),
      ],
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase().trim()
          ? `An account with email ${email} already exists.`
          : `An account with phone ${phone} already exists.`,
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password || 'Store@12345',
      phone,
      storeId: store.storeId,
      storeName: store.name,
      role: 'storeadmin',
      isVerified: true,
      isActive: true,
    });

    store.admin = name.trim();
    store.adminEmail = email.toLowerCase().trim();
    await store.save();

    res.status(201).json({ success: true, user });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'Phone/Email';
      return res.status(400).json({ success: false, message: `A user with this ${field} already exists.` });
    }
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

/**
 * PUT /api/super-admin/store-admins/:id
 * Update a store admin
 */
const updateStoreAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password, isActive } = req.body;
    
    const user = await User.findById(id);
    if (!user || user.role !== 'storeadmin') {
      return res.status(404).json({ success: false, message: 'Store admin not found' });
    }
    
    user.name = name || user.name;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    if (password) user.password = password;
    if (typeof isActive !== 'undefined') user.isActive = isActive;
    
    await user.save();

    if (user.storeId) {
      const store = await Store.findOne({ storeId: user.storeId });
      if (store) {
        store.admin = user.name;
        store.adminEmail = user.email;
        await store.save();
      }
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/super-admin/store-admins/:id
 * Delete a store admin
 */
const deleteStoreAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user || user.role !== 'storeadmin') {
      return res.status(404).json({ success: false, message: 'Store admin not found' });
    }
    
    if (user.storeId) {
      const store = await Store.findOne({ storeId: user.storeId });
      if (store) {
        store.admin = '—';
        store.adminEmail = '';
        await store.save();
      }
    }
    
    await user.deleteOne();
    res.status(200).json({ success: true, message: 'Store admin removed' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/super-admin/riders
 * List riders
 */
const getRiders = async (req, res, next) => {
  try {
    const riders = await User.find({ role: 'rider' }).select('-password');
    res.status(200).json({ success: true, count: riders.length, riders });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/super-admin/riders
 * Add a rider
 */
const createRider = async (req, res, next) => {
  try {
    let { name, email, password, phone, vehicleNumber, storeId } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Rider name is required' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Clean and normalize phone number
    phone = phone.replace(/[\s\-()]/g, '');
    if (phone.startsWith('0')) phone = phone.substring(1);
    if (!phone.startsWith('+') && phone.length === 10) phone = '+91' + phone;

    // Check if phone or email already exists
    const existingRider = await User.findOne({
      $or: [
        { phone },
        ...(email ? [{ email: email.toLowerCase().trim() }] : []),
      ],
    });

    if (existingRider) {
      if (existingRider.phone === phone) {
        return res.status(400).json({
          success: false,
          message: `Phone number ${phone} is already registered to ${existingRider.name || 'another account'}.`,
        });
      }
      if (email && existingRider.email === email.toLowerCase().trim()) {
        return res.status(400).json({
          success: false,
          message: `Email ${email} is already registered.`,
        });
      }
    }

    const rider = await User.create({
      name: name.trim(),
      email: email ? email.toLowerCase().trim() : `rider_${Date.now()}@teffes.com`,
      password: password || 'Rider@12345',
      phone,
      vehicleNumber: (vehicleNumber && vehicleNumber.trim()) || 'JH01-XX-0000',
      storeId: storeId || 'S001',
      role: 'rider',
      riderStatus: 'Available',
      isVerified: true,
      isActive: true,
    });
    res.status(201).json({ success: true, rider });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'Phone/Email';
      return res.status(400).json({ success: false, message: `A user with this ${field} already exists.` });
    }
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: msg });
    }
    next(error);
  }
};

/**
 * GET /api/super-admin/customers
 * List customers platform-wide
 */
const getPlatformCustomers = async (req, res, next) => {
  try {
    const customers = await User.find({ role: 'customer' }).select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: customers.length, customers });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/super-admin/coupons
 * List coupons
 */
const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: coupons.length, coupons });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/super-admin/coupons
 * Create coupon
 */
const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success: true, coupon });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/super-admin/orders
 * List all orders platform-wide
 */
const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/super-admin/settings
 * Get platform settings
 */
const getSettings = async (req, res) => {
  res.status(200).json({
    success: true,
    settings: {
      deliveryRadiusKm: 5,
      minOrderAmount: 199,
      freeDeliveryThreshold: 399,
      expressDeliveryFee: 40,
      roPurifiedWashStandard: 'ISO-22000 Certified',
      whatsappAlerts: true,
      maintenanceMode: false,
    },
  });
};

module.exports = {
  getPlatformDashboard,
  getStores,
  createStore,
  updateStore,
  deleteStore,
  getStoreAdmins,
  createStoreAdmin,
  updateStoreAdmin,
  deleteStoreAdmin,
  getRiders,
  createRider,
  getPlatformCustomers,
  getCoupons,
  createCoupon,
  getAllOrders,
  getSettings,
};

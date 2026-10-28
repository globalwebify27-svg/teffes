/**
 * Super Admin Controller (Pure Cloud Firestore Backend)
 * 100% Zero MongoDB dependency - Fully migrated to Google Cloud Firestore
 */

const bcrypt = require('bcryptjs');
const {
  getDb,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
} = require('../lib/firestore');

const {
  getAllStores,
  getActiveStores,
  getStoreById,
  createStore: createStoreFS,
  updateStore: updateStoreFS,
  deleteStore: deleteStoreFS,
} = require('../services/firestore/store.firestore.service');

const {
  getAllOrders: getAllOrdersFS,
  getOrderById,
} = require('../services/firestore/order.firestore.service');

const {
  getProducts,
} = require('../services/firestore/product.firestore.service');

const {
  getAllCoupons,
  getCouponByCode,
  createCoupon: createCouponFS,
  updateCoupon: updateCouponFS,
  deleteCoupon: deleteCouponFS,
} = require('../services/firestore/coupon.firestore.service');

/**
 * GET /api/super-admin/dashboard
 * Platform-wide KPIs & recent activity log (Firestore-backed)
 */
const getPlatformDashboard = async (req, res, next) => {
  try {
    const [
      orders,
      activeStores,
      allRiders,
      allCustomers,
      allProducts,
    ] = await Promise.all([
      getAllOrdersFS(),
      getActiveStores(),
      queryDocs('users', (ref) => ref.where('role', '==', 'rider')),
      queryDocs('users', (ref) => ref.where('role', '==', 'customer')),
      getProducts(),
    ]);

    const activeRiders = allRiders.filter((r) => r.isActive !== false);
    const deliveredOrders = orders.filter((o) => o.status === 'Delivered');
    const todayRevenue = deliveredOrders.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const activeStoresCount = activeStores.length;
    const activeRidersCount = activeRiders.length;
    const totalCustomersCount = allCustomers.length;
    const totalProductsCount = allProducts.length;
    const totalOrdersToday = orders.length;

    const kpis = [
      {
        icon: 'inventory_2',
        label: 'Total Orders Today',
        value: `${totalOrdersToday}`,
        sub: '↑ 18% vs yesterday',
        color: '#941717',
        tab: 'orders',
      },
      {
        icon: 'payments',
        label: 'Revenue Today',
        value: `₹${todayRevenue.toLocaleString('en-IN')}`,
        sub: `Across ${activeStoresCount} active stores`,
        color: '#c28114',
        tab: 'orders',
      },
      {
        icon: 'storefront',
        label: 'Active Stores',
        value: `${activeStoresCount}`,
        sub: activeStores.map((s) => s.name).join(', ') || 'Ranchi Kishore Ganj, Doranda',
        color: '#059669',
        tab: 'stores',
      },
      {
        icon: 'two_wheeler',
        label: 'Active Riders',
        value: `${activeRidersCount}`,
        sub: `${allRiders.filter((r) => r.riderStatus === 'On Delivery').length} out for delivery`,
        color: '#7c3aed',
        tab: 'riders',
      },
      {
        icon: 'group',
        label: 'Total Customers',
        value: `${totalCustomersCount}`,
        sub: 'Platform customers',
        color: '#0284c7',
        tab: 'customers',
      },
      {
        icon: 'restaurant',
        label: 'Total Products',
        value: `${totalProductsCount}`,
        sub: 'Master meat & seafood catalog',
        color: '#d97706',
        tab: 'products',
      },
    ];

    const recentActivity = orders.slice(0, 10).map((o) => ({
      time: o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
      event: `Order #${o.orderId || o.id} ${(o.status || 'Pending').toLowerCase()} for ${o.customer?.name || 'Customer'}`,
      store: o.storeName || 'Kishore Ganj',
      status: o.status || 'Pending',
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
    const stores = await getAllStores();
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
    let { storeId, ...rest } = req.body;

    const allStores = await getAllStores({ includeTest: true });

    if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') {
      let maxNum = 0;
      for (const s of allStores) {
        const idToCheck = s.storeId || s.id;
        if (idToCheck) {
          const match = String(idToCheck).match(/^S(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
      }
      storeId = `S${String(maxNum + 1).padStart(3, '0')}`;
    } else {
      storeId = storeId.trim();
      const existing = allStores.find((s) => s.storeId === storeId || s.id === storeId);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Store ID already exists. Please try again.' });
      }
    }

    const created = await createStoreFS({ storeId, ...rest });
    res.status(201).json({ success: true, store: created });
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
    const store = await updateStoreFS(id, req.body);
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
    await deleteStoreFS(id);
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
    const admins = await queryDocs('users', (ref) => ref.where('role', '==', 'storeadmin'));
    const safeAdmins = admins.map((a) => {
      const copy = { ...a };
      delete copy.password;
      return copy;
    });
    res.status(200).json({ success: true, count: safeAdmins.length, admins: safeAdmins });
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

    const cleanStoreId = storeId.trim();
    const store = await getStoreById(cleanStoreId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const emailClean = email.toLowerCase().trim();
    const existingByEmail = await queryDocs('users', (ref) => ref.where('email', '==', emailClean).limit(1));
    if (existingByEmail.length > 0) {
      return res.status(400).json({ success: false, message: `An account with email ${email} already exists.` });
    }

    if (phone) {
      const existingByPhone = await queryDocs('users', (ref) => ref.where('phone', '==', phone).limit(1));
      if (existingByPhone.length > 0) {
        return res.status(400).json({ success: false, message: `An account with phone ${phone} already exists.` });
      }
    }

    const hashedPassword = await bcrypt.hash(password || 'Store@12345', 10);
    const userId = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const userData = {
      id: userId,
      _id: userId,
      name: name.trim(),
      email: emailClean,
      password: hashedPassword,
      phone: phone || '',
      storeId: store.storeId || cleanStoreId,
      storeName: store.name || '',
      role: 'storeadmin',
      isVerified: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await createDoc('users', userId, userData);

    // Update store manager info
    try {
      await updateStoreFS(store.storeId || cleanStoreId, {
        admin: name.trim(),
        adminEmail: emailClean,
      });
    } catch (_) {}

    const safeUser = { ...userData };
    delete safeUser.password;

    res.status(201).json({ success: true, user: safeUser });
  } catch (error) {
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
    const { name, email, phone, password, isActive, storeId } = req.body;

    const user = await getDoc('users', id);
    if (!user || user.role !== 'storeadmin') {
      return res.status(404).json({ success: false, message: 'Store admin not found' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (phone) updates.phone = phone.trim();
    if (typeof isActive !== 'undefined') updates.isActive = Boolean(isActive);
    if (storeId) {
      updates.storeId = storeId.trim();
      const s = await getStoreById(storeId.trim());
      if (s) updates.storeName = s.name;
    }
    if (password && password.trim()) {
      updates.password = await bcrypt.hash(password.trim(), 10);
    }
    updates.updatedAt = new Date().toISOString();

    const updated = await updateDoc('users', id, updates);

    const safeUser = { ...updated };
    delete safeUser.password;

    res.status(200).json({ success: true, user: safeUser });
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
    const user = await getDoc('users', id);
    if (!user || user.role !== 'storeadmin') {
      return res.status(404).json({ success: false, message: 'Store admin not found' });
    }

    if (user.storeId) {
      try {
        await updateStoreFS(user.storeId, {
          admin: '—',
          adminEmail: '',
        });
      } catch (_) {}
    }

    await deleteDoc('users', id);
    res.status(200).json({ success: true, message: 'Store admin removed' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/super-admin/riders
 * List riders with real-time delivery status
 */
const getRiders = async (req, res, next) => {
  try {
    const riders = await queryDocs('users', (ref) => ref.where('role', '==', 'rider'));
    const orders = await getAllOrdersFS();
    const activeOrders = orders.filter((o) => o.status === 'Out for Delivery');

    const activeRiderIdentifiers = new Set();
    activeOrders.forEach((o) => {
      if (o.rider?.riderId) activeRiderIdentifiers.add(o.rider.riderId.toString());
      if (o.rider?.phone) activeRiderIdentifiers.add(o.rider.phone.replace(/\D/g, ''));
      if (o.rider?.name) activeRiderIdentifiers.add(o.rider.name.trim().toLowerCase());
    });

    const updatedRiders = await Promise.all(
      riders.map(async (r) => {
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
 * POST /api/super-admin/riders
 * Add a rider
 */
const createRider = async (req, res, next) => {
  try {
    let { name, email, password, phone, vehicleNumber, storeId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Rider name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required for rider login' });
    }
    email = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    phone = phone.replace(/[\s\-()]/g, '');
    if (phone.startsWith('0')) phone = phone.substring(1);
    if (!phone.startsWith('+') && phone.length === 10) phone = '+91' + phone;

    const existingEmail = await queryDocs('users', (ref) => ref.where('email', '==', email).limit(1));
    if (existingEmail.length > 0) {
      return res.status(400).json({ success: false, message: `Email ${email} is already registered.` });
    }

    const existingPhone = await queryDocs('users', (ref) => ref.where('phone', '==', phone).limit(1));
    if (existingPhone.length > 0) {
      return res.status(400).json({ success: false, message: `Phone number ${phone} is already registered.` });
    }

    let storeName = 'Ranchi Kishore Ganj';
    if (storeId === 'S004' || storeId === 'S002') {
      storeName = "TeFFe's — Doranda Hub";
    } else if (storeId === 'S003') {
      storeName = "TeFFe's — Harmu Road";
    } else if (storeId) {
      const s = await getStoreById(storeId);
      if (s) storeName = s.name;
    }

    const defaultPass = password && password.trim() ? password.trim() : 'Rider@12345';
    const hashedPassword = await bcrypt.hash(defaultPass, 10);
    const userId = `rider_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const riderData = {
      id: userId,
      _id: userId,
      name: name.trim(),
      email,
      password: hashedPassword,
      phone,
      vehicleNumber: (vehicleNumber && vehicleNumber.trim()) || 'JH01-EC-1234',
      storeId: storeId || 'S001',
      storeName,
      role: 'rider',
      riderStatus: 'Available',
      isVerified: true,
      isActive: true,
      dailyTarget: 16,
      cashInHand: 0,
      walletBalance: 0,
      createdAt: now,
      updatedAt: now,
    };

    await createDoc('users', userId, riderData);

    const safeRider = { ...riderData };
    delete safeRider.password;

    res.status(201).json({ success: true, rider: safeRider });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/super-admin/riders/:id
 * Update a rider
 */
const updateRider = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { name, email, phone, vehicleNumber, storeId, riderStatus, isActive, password } = req.body;

    const rider = await getDoc('users', id);
    if (!rider || rider.role !== 'rider') {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }

    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (email && email.trim()) updates.email = email.toLowerCase().trim();

    if (phone && phone.trim()) {
      let cleanPhone = phone.replace(/[\s\-()]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
      if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) cleanPhone = '+91' + cleanPhone;

      const existingPhone = await queryDocs('users', (ref) => ref.where('phone', '==', cleanPhone).limit(1));
      if (existingPhone.length > 0 && existingPhone[0].id !== id) {
        return res.status(400).json({ success: false, message: `Phone number ${cleanPhone} is already registered.` });
      }
      updates.phone = cleanPhone;
    }

    if (typeof vehicleNumber !== 'undefined') updates.vehicleNumber = vehicleNumber.trim();
    if (typeof storeId !== 'undefined' && storeId.trim()) {
      updates.storeId = storeId.trim();
      const s = await getStoreById(storeId.trim());
      if (s) updates.storeName = s.name;
    }
    if (riderStatus) updates.riderStatus = riderStatus;
    if (typeof isActive !== 'undefined') updates.isActive = Boolean(isActive);

    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      }
      updates.password = await bcrypt.hash(password.trim(), 10);
    }
    updates.updatedAt = new Date().toISOString();

    const updated = await updateDoc('users', id, updates);
    const safeRider = { ...updated };
    delete safeRider.password;

    res.status(200).json({ success: true, rider: safeRider });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/super-admin/riders/:id
 * Delete a rider
 */
const deleteRider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rider = await getDoc('users', id);
    if (!rider || rider.role !== 'rider') {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }

    await deleteDoc('users', id);
    res.status(200).json({ success: true, message: 'Rider deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/super-admin/customers
 * List customers platform-wide
 */
const getPlatformCustomers = async (req, res, next) => {
  try {
    const customers = await queryDocs('users', (ref) => ref.where('role', '==', 'customer'));
    const safeCustomers = customers.map((c) => {
      const copy = { ...c };
      delete copy.password;
      return copy;
    });
    safeCustomers.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.status(200).json({ success: true, count: safeCustomers.length, customers: safeCustomers });
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
    const coupons = await getAllCoupons({ includeTest: false });
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
    const {
      code,
      discountType = 'percentage',
      discountValue,
      minOrderAmount,
      minOrder,
      maxDiscountAmount,
      validFrom,
      validTill,
      firstOrderOnly,
      usageLimit,
      description,
      discount,
      isSuperOffer,
      isActive,
    } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Promo code is required.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be greater than 0.' });
    }

    const minAmount = Number(minOrderAmount !== undefined ? minOrderAmount : minOrder || 0);
    const fromDate = validFrom ? new Date(validFrom).toISOString() : new Date().toISOString();
    const tillDate = validTill ? new Date(validTill).toISOString() : new Date('2026-12-31T23:59:59.999Z').toISOString();

    const desc = (description || discount || `${val}% off`).trim();

    if (isSuperOffer) {
      const allCoupons = await getAllCoupons();
      for (const c of allCoupons) {
        if (c.isSuperOffer) {
          await updateCouponFS(c.code, { isSuperOffer: false });
        }
      }
    }

    const couponData = {
      code: cleanCode,
      discountType,
      discountValue: val,
      minOrderAmount: minAmount,
      minOrder: minAmount,
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
      validFrom: fromDate,
      validTill: tillDate,
      firstOrderOnly: Boolean(firstOrderOnly),
      usageLimit: usageLimit ? Number(usageLimit) : null,
      description: desc,
      discount: desc,
      isSuperOffer: Boolean(isSuperOffer),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      status: (isActive !== undefined && !isActive) ? 'Paused' : 'Active',
    };

    const created = await createCouponFS(couponData);
    res.status(201).json({ success: true, coupon: created });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/super-admin/coupons/:id
 * Update coupon
 */
const updateCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cleanId = id.trim().toUpperCase();
    const updates = { ...req.body };

    if (updates.isSuperOffer) {
      const allCoupons = await getAllCoupons();
      for (const c of allCoupons) {
        if (c.code !== cleanId && c.isSuperOffer) {
          await updateCouponFS(c.code, { isSuperOffer: false });
        }
      }
    }

    const updated = await updateCouponFS(cleanId, updates);
    res.status(200).json({ success: true, coupon: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/super-admin/coupons/:id
 * Delete a coupon
 */
const deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteCouponFS(id.trim().toUpperCase());
    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/super-admin/coupons/:id/super-offer
 * Designate a coupon as the platform-wide Super Offer
 */
const setSuperOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cleanCode = id.trim().toUpperCase();

    const allCoupons = await getAllCoupons();
    for (const c of allCoupons) {
      if (c.isSuperOffer) {
        await updateCouponFS(c.code, { isSuperOffer: false });
      }
    }

    const updated = await updateCouponFS(cleanCode, { isSuperOffer: true, status: 'Active', isActive: true });
    res.status(200).json({
      success: true,
      message: `Coupon "${cleanCode}" set as platform Super Offer`,
      coupon: updated,
    });
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
    const orders = await getAllOrdersFS();
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
  updateRider,
  deleteRider,
  getPlatformCustomers,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  setSuperOffer,
  getAllOrders,
  getSettings,
};

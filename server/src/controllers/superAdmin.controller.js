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
  parseDateMillis,
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
  getPaginatedOrders: getPaginatedOrdersFS,
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

const {
  ensureStoreInventory,
  getInventoryHistory: getInventoryHistoryFS,
} = require('../services/firestore/inventory.firestore.service');

/**
 * GET /api/super-admin/dashboard
 * Platform-wide KPIs & recent activity log (Firestore-backed)
 */
const getPlatformDashboard = async (req, res, next) => {
  try {
    const [
      ordersResult,
      activeStores,
      allRiders,
      allCustomers,
      productsResult,
    ] = await Promise.all([
      getPaginatedOrdersFS({ page: 1, limit: 150 }),
      getActiveStores(),
      queryDocs('users', (ref) => ref.where('role', '==', 'rider')),
      queryDocs('users', (ref) => ref.where('role', '==', 'customer')),
      getProducts({ all: true, limit: 1000 }),
    ]);

    const orders = ordersResult?.orders || [];

    // Safe helper to convert any Firestore timestamp or ISO string into milliseconds
    const toEpoch = (val) => {
      if (!val) return 0;
      if (val._seconds) return val._seconds * 1000;
      if (val.seconds) return val.seconds * 1000;
      const d = new Date(val);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    // Calculate Indian Standard Time (IST, UTC+05:30) day bounds for accurate daily metrics
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    const istYear = nowIST.getUTCFullYear();
    const istMonth = nowIST.getUTCMonth();
    const istDate = nowIST.getUTCDate();

    const startTodayISTUtcEpoch = Date.UTC(istYear, istMonth, istDate) - istOffset;
    const startYesterdayISTUtcEpoch = startTodayISTUtcEpoch - 24 * 60 * 60 * 1000;

    // Filter orders by creation date
    const todayOrders = orders.filter((o) => toEpoch(o.createdAt) >= startTodayISTUtcEpoch);
    const yesterdayOrders = orders.filter((o) => {
      const t = toEpoch(o.createdAt);
      return t >= startYesterdayISTUtcEpoch && t < startTodayISTUtcEpoch;
    });

    // Orders trend calculation
    const todayOrdersCount = todayOrders.length;
    let ordersTrendSub = '';
    if (yesterdayOrders.length > 0) {
      const diff = todayOrdersCount - yesterdayOrders.length;
      const pct = Math.round((diff / yesterdayOrders.length) * 100);
      ordersTrendSub = pct >= 0 ? `↑ ${pct}% vs yesterday` : `↓ ${Math.abs(pct)}% vs yesterday`;
    } else if (todayOrdersCount > 0) {
      ordersTrendSub = `↑ ${todayOrdersCount} placed today`;
    } else {
      ordersTrendSub = 'No orders today';
    }

    // Revenue calculation (orders delivered today)
    const todayDeliveredOrders = todayOrders.filter((o) => o.status === 'Delivered');
    const todayRevenue = todayDeliveredOrders.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    // Platform metrics
    const activeRiders = allRiders.filter((r) => r.isActive !== false);
    const activeStoresCount = activeStores.length;
    const activeRidersCount = activeRiders.length;
    const onDeliveryRidersCount = allRiders.filter((r) => r.riderStatus === 'On Delivery').length;

    // Customers metrics
    const totalCustomersCount = allCustomers.length;
    const verifiedCustomersCount = allCustomers.filter((c) => c.isVerified !== false).length;

    // Products metrics from master catalog (handling object return from getProducts)
    const catalogProducts = Array.isArray(productsResult)
      ? productsResult
      : (productsResult?.products || []);
    const totalProductsCount = productsResult?.total ?? catalogProducts.length;
    const inStockProductsCount = catalogProducts.filter(
      (p) => p.inStock !== false
    ).length;
    const categoryCount = new Set(catalogProducts.map((p) => p.category).filter(Boolean)).size || 3;

    const kpis = [
      {
        icon: 'inventory_2',
        label: 'Total Orders Today',
        value: `${todayOrdersCount}`,
        sub: ordersTrendSub,
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
        sub: `${onDeliveryRidersCount} out for delivery`,
        color: '#7c3aed',
        tab: 'riders',
      },
      {
        icon: 'group',
        label: 'Total Customers',
        value: `${totalCustomersCount}`,
        sub: `${verifiedCustomersCount} verified platform accounts`,
        color: '#0284c7',
        tab: 'customers',
      },
      {
        icon: 'restaurant',
        label: 'Total Products',
        value: `${totalProductsCount}`,
        sub: `${inStockProductsCount} in stock across ${categoryCount} categories`,
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

    try {
      await ensureStoreInventory(storeId, { defaultFreshStock: 0, defaultDefreezeStock: 0, defaultWasteStock: 0 });
    } catch (invErr) {
      console.warn(`[createStore] Auto-init inventory warning for ${storeId}:`, invErr.message);
    }

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
    const activeOrders = await queryDocs('orders', (ref) => ref.where('status', '==', 'Out for Delivery'));

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
 * Formats a timestamp into DD/MM/YYYY in Indian Standard Time (IST).
 */
const formatDDMMYYYY_IST = (dateInput) => {
  const ms = parseDateMillis(dateInput);
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
  const orderMs = parseDateMillis(orderDateInput);
  if (!orderMs) return null;

  const orderIST = new Date(orderMs + (5.5 * 60 * 60 * 1000));
  const orderDayStartMs = Date.UTC(orderIST.getUTCFullYear(), orderIST.getUTCMonth(), orderIST.getUTCDate());

  const nowIST = new Date(refNowMs + (5.5 * 60 * 60 * 1000));
  const nowDayStartMs = Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate());

  const diffDays = Math.round((nowDayStartMs - orderDayStartMs) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
};

/**
 * GET /api/super-admin/customers
 * List customers platform-wide
 */
const getPlatformCustomers = async (req, res, next) => {
  try {
    const [users, allOrders] = await Promise.all([
      queryDocs('users', (ref) => ref.where('role', '==', 'customer')),
      getAllOrdersFS({ includeTest: false }),
    ]);

    // Exclude test users from platform directory
    const activeUsers = users.filter((u) => !u.isTest && u.role === 'customer');

    // Filter valid orders: exclude cancelled and failed payments
    const validOrders = allOrders.filter(
      (o) => !o.isTest && o.status !== 'Cancelled' && o.paymentStatus !== 'Failed'
    );

    const customerMap = new Map();
    const userIdToKeyMap = new Map();

    const genericNames = ['verified gourmet user', 'valued customer', 'customer'];

    // 1. Index registered users
    for (const u of activeUsers) {
      const copy = { ...u };
      delete copy.password;
      const cleanPhone = String(copy.phone || '').replace(/\D/g, '').slice(-10);
      const uId = String(copy.id || copy._id || '').trim();

      const key = cleanPhone || uId;
      if (!key) continue;

      if (uId) {
        userIdToKeyMap.set(uId, key);
      }

      if (customerMap.has(key)) {
        const existing = customerMap.get(key);
        if (genericNames.includes((existing.name || '').trim().toLowerCase())) {
          if (copy.name && !genericNames.includes(copy.name.trim().toLowerCase())) {
            existing.name = copy.name;
          }
        }
      } else {
        const defaultAddress = (copy.addresses && copy.addresses.length > 0)
          ? `${copy.addresses[0].line1 || ''}, ${copy.addresses[0].city || 'Ranchi'}`
          : (copy.address || 'Ranchi');

        customerMap.set(key, {
          ...copy,
          id: copy.id || copy._id || `cust_${key}`,
          phone: cleanPhone ? `+91 ${cleanPhone}` : (copy.phone || 'Unknown'),
          address: defaultAddress,
          addresses: copy.addresses && copy.addresses.length > 0 ? copy.addresses : [{ line1: defaultAddress, city: 'Ranchi', isDefault: true }],
          walletBalance: Number(copy.walletBalance) || 0,
          totalOrders: 0,
          orders: 0,
          totalSpent: 0,
          _orderIds: new Set(),
        });
      }
    }

    // 2. Unify with all orders across all stores
    for (const o of validOrders) {
      const oId = String(o.orderId || o.id || o._id || '');
      const amt = Number(o.amount != null ? o.amount : o.totalAmount) || 0;
      const rawPhone = o.customer?.phone || '';
      const oPhone = String(rawPhone).replace(/\D/g, '').slice(-10);
      const oUserId = o.customer?.userId ? String(o.customer.userId).trim() : null;

      let key = oPhone;
      if (!key && oUserId && userIdToKeyMap.has(oUserId)) {
        key = userIdToKeyMap.get(oUserId);
      } else if (!key && oUserId) {
        key = oUserId;
      }

      if (!key) continue;

      let entry = customerMap.get(key);
      if (!entry) {
        const orderAddress = o.customer?.address || o.shippingAddress?.address || 'Ranchi';
        entry = {
          id: oUserId || `cust_${key}`,
          name: o.customer?.name || 'Customer',
          phone: oPhone ? `+91 ${oPhone}` : (rawPhone || 'Unknown'),
          email: o.customer?.email || '',
          address: orderAddress,
          addresses: [{ line1: orderAddress, city: 'Ranchi', isDefault: true }],
          walletBalance: 0,
          totalOrders: 0,
          orders: 0,
          totalSpent: 0,
          _orderIds: new Set(),
          createdAt: o.createdAt || new Date().toISOString(),
        };
        customerMap.set(key, entry);
      }

      // Name resolution: prefer real checkout name over generic placeholder
      const currentNameLower = (entry.name || '').trim().toLowerCase();
      const orderName = (o.customer?.name || '').trim();
      if (orderName && (!entry.name || genericNames.includes(currentNameLower))) {
        entry.name = orderName;
      }

      // Address resolution: update if address is default 'Ranchi'
      if ((!entry.address || entry.address === 'Ranchi') && (o.customer?.address || o.shippingAddress?.address)) {
        const addr = o.customer?.address || o.shippingAddress?.address;
        entry.address = addr;
        if (!entry.addresses || entry.addresses.length === 0 || entry.addresses[0].line1 === 'Ranchi') {
          entry.addresses = [{ line1: addr, city: 'Ranchi', isDefault: true }];
        }
      }

      // Mathematical order & spent calculation (strictly de-duplicated by order ID)
      if (!entry._orderIds.has(oId)) {
        entry._orderIds.add(oId);
        entry.totalOrders = entry._orderIds.size;
        entry.orders = entry.totalOrders;
        entry.totalSpent = Math.round((entry.totalSpent + amt) * 100) / 100;
      }

      // Track latest order date across all customer orders
      const oDateMs = parseDateMillis(o.createdAt);
      if (oDateMs && (!entry._lastOrderDateMs || oDateMs > entry._lastOrderDateMs)) {
        entry._lastOrderDateMs = oDateMs;
        entry.lastOrderDate = new Date(oDateMs).toISOString();
        entry.lastOrder = formatDDMMYYYY_IST(oDateMs);
      }
    }

    const nowMs = Date.now();
    const safeCustomers = Array.from(customerMap.values()).map((c) => {
      delete c._orderIds;
      const lastMs = c._lastOrderDateMs || null;
      delete c._lastOrderDateMs;
      c.totalSpent = Math.round((Number(c.totalSpent) || 0) * 100) / 100;

      const daysSince = lastMs ? getCalendarDaysSinceOrderIST(lastMs, nowMs) : null;
      c.daysSinceLastOrder = daysSince;

      const count = Number(c.totalOrders || c.orders || 0);
      const createdMs = parseDateMillis(c.createdAt);
      const accountAge = createdMs ? Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24)) : 0;

      if (count >= 2) {
        c.segment = (daysSince != null && daysSince <= 30) ? 'active' : 'inactive';
      } else if (count === 1) {
        c.segment = (daysSince != null && daysSince <= 30) ? 'new' : 'inactive';
      } else {
        c.segment = accountAge <= 30 ? 'new' : 'inactive';
      }
      return c;
    });

    // Sort customers with orders first, then totalOrders desc, totalSpent desc
    safeCustomers.sort((a, b) => {
      const orderDiff = (b.totalOrders || 0) - (a.totalOrders || 0);
      if (orderDiff !== 0) return orderDiff;
      const spentDiff = (b.totalSpent || 0) - (a.totalSpent || 0);
      if (spentDiff !== 0) return spentDiff;
      return parseDateMillis(b.createdAt) - parseDateMillis(a.createdAt);
    });

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
      targetTiers,
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

    let sanitizedTiers = ['general'];
    if (Array.isArray(targetTiers) && targetTiers.length > 0) {
      sanitizedTiers = targetTiers.map((t) => String(t).toLowerCase().trim()).filter(Boolean);
    } else if (typeof targetTiers === 'string' && targetTiers.trim()) {
      sanitizedTiers = [targetTiers.toLowerCase().trim()];
    }

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
      targetTiers: sanitizedTiers,
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

    if (updates.targetTiers !== undefined) {
      if (Array.isArray(updates.targetTiers) && updates.targetTiers.length > 0) {
        updates.targetTiers = updates.targetTiers.map((t) => String(t).toLowerCase().trim()).filter(Boolean);
      } else if (typeof updates.targetTiers === 'string' && updates.targetTiers.trim()) {
        updates.targetTiers = [updates.targetTiers.toLowerCase().trim()];
      } else {
        updates.targetTiers = ['general'];
      }
    }

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
 * List all orders platform-wide (with True Server-Side Pagination support)
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { page, limit, status, area, date, storeId } = req.query || {};

    if (page !== undefined || limit !== undefined) {
      const result = await getPaginatedOrdersFS({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 50,
        status,
        area,
        date,
        storeId,
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

    // Fallback if page not provided
    const orders = await getAllOrdersFS();
    res.status(200).json({
      success: true,
      count: orders.length,
      totalCount: orders.length,
      orders,
    });
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

/**
 * GET /api/super-admin/inventory/history
 * List platform-wide inventory logs with store filtering, date range, and pagination
 */
const getInventoryHistory = async (req, res, next) => {
  try {
    const { storeId, itemId, actionType, classification, search, startDate, endDate, page = 1, limit = 50 } = req.query;

    const result = await getInventoryHistoryFS(storeId && storeId !== 'all' ? storeId : null, {
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

const { getPaymentSettings: getPaymentSettingsFS, updateSettings: updateSiteSettingsFS } = require('../services/firestore/siteSettings.firestore.service');

/**
 * GET /api/super-admin/payment-settings
 * Retrieve full payment method toggles and PayU credentials
 */
const getSuperAdminPaymentSettings = async (req, res, next) => {
  try {
    const settings = await getPaymentSettingsFS();
    res.status(200).json({
      success: true,
      paymentSettings: settings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/super-admin/payment-settings
 * Update payment method toggles and PayU credentials
 */
const updateSuperAdminPaymentSettings = async (req, res, next) => {
  try {
    const { codEnabled, onlineEnabled, walletEnabled, payuMerchantKey, payuMerchantSalt } = req.body;
    const updated = await updateSiteSettingsFS({
      paymentSettings: {
        codEnabled,
        onlineEnabled,
        walletEnabled,
        payuMerchantKey,
        payuMerchantSalt,
      },
    });
    res.status(200).json({
      success: true,
      message: 'Payment methods and PayU credentials saved successfully',
      paymentSettings: updated.paymentSettings,
    });
  } catch (error) {
    next(error);
  }
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
  getInventoryHistory,
  getSuperAdminPaymentSettings,
  updateSuperAdminPaymentSettings,
};

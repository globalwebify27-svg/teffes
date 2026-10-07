const { Router } = require('express');
const authRoutes = require('./auth.routes');
const productRoutes = require('./product.routes');
const storeAdminRoutes = require('./storeAdmin.routes');
const superAdminRoutes = require('./superAdmin.routes');
const userRoutes = require('./user.routes');
const orderRoutes = require('./order.routes');
const paymentRoutes = require('./payment.routes');
const couponRoutes = require('./coupon.routes');
const walletRoutes = require('./wallet.routes');
const reviewRoutes = require('./review.routes');
const { protect } = require('../middlewares/auth');
const Order = require('../models/Order');
const Store = require('../models/Store');
const Inventory = require('../models/Inventory');

const router = Router();

router.use('/auth', authRoutes);
router.use('/', productRoutes); // provides /categories, /products, /products/:id
router.use('/user', userRoutes); // provides persistent /user/cart, /user/wishlist
router.use('/orders', orderRoutes);
router.use('/payment', paymentRoutes);
router.use('/coupons', couponRoutes);
router.use('/banners', require('./banner.routes'));
router.use('/wallet', walletRoutes);
router.use('/reviews', reviewRoutes);
router.use('/transfers', require('./transfer.routes'));
router.use('/store-admin', storeAdminRoutes);
router.use('/super-admin', superAdminRoutes);
router.use('/rider', require('./rider.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/location', require('./location.routes'));
router.use('/upload', require('./upload.routes'));

const { matchCartItemToInventory, getItemRequiredAmount } = require('../services/inventoryService');

// Distance calculation between customer and store coordinates (in km)
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

/**
 * Filter stores by:
 * 1. Active status & Open
 * 2. deliveryEnabled / pickupEnabled
 * 3. Inventory availability for selected items & quantities
 * 4. Sort ascending by distance (nearest shop first)
 */
const getAvailableStoresHandler = async (req, res, next) => {
  try {
    const type = (req.body?.type || req.query?.type || 'delivery').toLowerCase();
    let items = req.body?.items;
    if (!items && req.query?.items) {
      try {
        items = typeof req.query.items === 'string' ? JSON.parse(req.query.items) : req.query.items;
      } catch (_) {
        items = [];
      }
    }
    items = Array.isArray(items) ? items : [];

    const customerLat = Number(req.body?.customerLat || req.query?.customerLat || 23.3512);
    const customerLng = Number(req.body?.customerLng || req.query?.customerLng || 85.3154);

    const storeQuery = {
      status: 'Active',
      isOpen: { $ne: false },
    };

    if (type === 'pickup') {
      storeQuery.pickupEnabled = { $ne: false };
    } else {
      storeQuery.deliveryEnabled = { $ne: false };
    }

    const stores = await Store.find(storeQuery).lean();
    const evaluatedStores = [];

    for (const store of stores) {
      let storeLat = 23.3441;
      let storeLng = 85.3096;
      if (store.location && Array.isArray(store.location.coordinates) && store.location.coordinates.length >= 2) {
        storeLng = store.location.coordinates[0];
        storeLat = store.location.coordinates[1];
      }

      const distKm = calculateDistanceKm(customerLat, customerLng, storeLat, storeLng) ?? 1.5;

      // Verify inventory in this specific store
      let isAvailable = true;
      const outOfStockItems = [];
      const invList = await Inventory.find({ storeId: store.storeId }).lean();

      if (items.length > 0) {
        if (!invList || invList.length === 0) {
          isAvailable = false;
          outOfStockItems.push('Catalog unstocked at this location');
        } else {
          for (const item of items) {
            const matchedInv = matchCartItemToInventory(item, invList);
            const reqAmount = matchedInv ? getItemRequiredAmount(item, matchedInv.unit) : (Number(item.quantity) || 1);
            if (!matchedInv) {
              isAvailable = false;
              outOfStockItems.push(item.name || 'Item unavailable');
            } else if (matchedInv.status === 'Out of Stock' || (matchedInv.stock !== undefined && matchedInv.stock < reqAmount)) {
              isAvailable = false;
              outOfStockItems.push(`${item.name} (Stock: ${matchedInv.stock || 0} ${matchedInv.unit || 'kg'})`);
            }
          }
        }
      }

      evaluatedStores.push({
        ...store,
        distanceKm: distKm,
        distance: `${distKm} km away`,
        isAvailable,
        outOfStockItems,
        stockStatus: isAvailable ? 'In Stock' : 'Out of Stock',
      });
    }

    // Sort: Available stores first, then by nearest distance ascending
    evaluatedStores.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      return a.distanceKm - b.distanceKm;
    });

    const eligibleStores = evaluatedStores.filter((s) => s.isAvailable);
    const suggestedStore = eligibleStores.length > 0 ? eligibleStores[0] : (evaluatedStores[0] || null);

    res.status(200).json({
      success: true,
      count: evaluatedStores.length,
      eligibleCount: eligibleStores.length,
      stores: evaluatedStores,
      eligibleStores,
      suggestedStore,
    });
  } catch (error) {
    next(error);
  }
};

// Endpoints for available & filtered store selection
router.get('/stores/available', getAvailableStoresHandler);
router.post('/stores/available', getAvailableStoresHandler);
router.get('/stores', getAvailableStoresHandler);

// Customer Orders & Tracking
router.get('/orders/my-orders', protect, async (req, res, next) => {
  try {
    const orders = await Order.find({
      $or: [
        { 'customer.userId': req.user._id },
        { 'customer.phone': req.user.phone },
        { 'customer.email': req.user.email },
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    next(error);
  }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({
      $or: [{ orderId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

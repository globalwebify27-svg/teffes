/**
 * TeFFe Production API Routes (Cloud Firestore Backend)
 * 
 * Cutover Status: Live Production Routed to Google Cloud Firestore
 * Rollback Guard: MongoDB Mongoose models preserved in server/src/models/
 */

const { Router } = require('express');
const { protectStaging, requireStagingRole } = require('../middlewares/stagingAuth');

const auth = require('../controllers/staging/auth.staging.controller');
const catalog = require('../controllers/staging/catalog.staging.controller');
const orders = require('../controllers/staging/orders.staging.controller');
const operational = require('../controllers/staging/operational.staging.controller');

const { getActiveStores, getStoreById } = require('../services/firestore/store.firestore.service');
const { getStoreInventory } = require('../services/firestore/inventory.firestore.service');
const { matchCartItemToInventory, getItemRequiredAmount } = require('../services/inventoryService');

const router = Router();

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

// ─── Available Stores Filter (Firestore-backed) ─────────────────────────────
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

    const activeStores = await getActiveStores();
    const evaluatedStores = [];

    for (const store of activeStores) {
      if (type === 'pickup' && store.pickupEnabled === false) continue;
      if (type === 'delivery' && store.deliveryEnabled === false) continue;

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
      const invList = await getStoreInventory(store.storeId);

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
        freeDeliveryThreshold: store.freeDeliveryThreshold ?? 399,
        standardDeliveryFee: store.standardDeliveryFee ?? 40,
        expressDeliveryFee: store.expressDeliveryFee ?? 50,
        expressDeliveryEnabled: store.expressDeliveryEnabled !== false,
        rainSurgeEnabled: store.rainSurgeEnabled === true,
        rainSurgeFee: store.rainSurgeFee ?? 15,
        freeGiftThreshold: store.freeGiftThreshold ?? 499,
        freeGiftName: store.freeGiftName || 'Free Biryani Rice (500g)',
        deliveryRadiusKm: store.deliveryRadiusKm ?? 5,
        defaultRiderDailyTarget: store.defaultRiderDailyTarget ?? 16,
        distanceKm: distKm,
        distance: `${distKm} km away`,
        isAvailable,
        outOfStockItems,
        stockStatus: isAvailable ? 'In Stock' : 'Out of Stock',
      });
    }

    evaluatedStores.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      return a.distanceKm - b.distanceKm;
    });

    const eligibleStores = evaluatedStores.filter((s) => s.isAvailable);
    const suggestedStore = eligibleStores.length > 0 ? eligibleStores[0] : (evaluatedStores[0] || null);

    return res.status(200).json({
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

// ─── Authentication & Profile ───────────────────────────────────────────────
router.post('/auth/firebase-login', auth.firebaseLogin);
router.post('/auth/admin-login', auth.adminLogin);
router.get('/auth/me', protectStaging, auth.getMe);
router.put('/auth/me', protectStaging, auth.updateMe);
router.get('/auth/addresses', protectStaging, auth.getUserAddresses);
router.post('/auth/addresses', protectStaging, auth.createUserAddress);
router.put('/auth/addresses/:addressId', protectStaging, auth.updateUserAddress);
router.delete('/auth/addresses/:addressId', protectStaging, auth.deleteUserAddress);

// ─── User Cart & Wishlist ───────────────────────────────────────────────────
router.get('/user/cart', protectStaging, auth.getUserCart);
router.post('/user/cart', protectStaging, auth.setUserCart);
router.delete('/user/cart', protectStaging, auth.emptyUserCart);
router.get('/user/wishlist', protectStaging, auth.getUserWishlist);
router.post('/user/wishlist', protectStaging, auth.toggleUserWishlist);

// ─── Master Data, Categories, Products & SEO ────────────────────────────────
router.get('/categories', catalog.getCategories);
router.get('/categories/:slug', catalog.getCategory);
router.get('/products', catalog.listProducts);
router.get('/products/:id', catalog.getProduct);
router.get('/banners', catalog.getBanners);
router.get('/seo', catalog.getSeoSettings);
router.get('/settings/seo', catalog.getSeoSettings);
router.get('/cross-sell', catalog.getCrossSell);

// ─── Stores & Inventory ─────────────────────────────────────────────────────
router.get('/stores/available', getAvailableStoresHandler);
router.post('/stores/available', getAvailableStoresHandler);
router.get('/stores', catalog.listStores);
router.get('/stores/:storeId', catalog.getStore);
router.get('/inventory/:storeId', catalog.getInventoryByStore);
router.get('/inventory/:storeId/:itemId', catalog.getInventoryByItem);

// Active Announcements & Emergency Notice Endpoint
router.get('/announcements/active', async (req, res, next) => {
  try {
    const stores = await getActiveStores();
    const store = stores.find((s) => s.emergencyNotice && s.emergencyNotice.trim());
    return res.status(200).json({
      success: true,
      notice: store?.emergencyNotice || '',
      storeName: store?.name || '',
      isOpen: store ? store.isOpen !== false : true,
      timings: store?.timings || '',
    });
  } catch (error) {
    next(error);
  }
});

// ─── Orders, Checkout, Wallet & Coupons ─────────────────────────────────────
router.post('/orders', protectStaging, orders.createOrder);
router.get('/orders/my-orders', protectStaging, orders.getMyOrders);
router.get('/orders/store/:storeId', protectStaging, requireStagingRole('storeadmin', 'superadmin', 'admin'), orders.getOrdersForStore);
router.get('/orders/:orderId', protectStaging, orders.getOrderById);
router.put('/orders/:orderId/status', protectStaging, requireStagingRole('storeadmin', 'superadmin', 'rider'), orders.updateStatus);
router.put('/orders/:orderId/assign-rider', protectStaging, requireStagingRole('storeadmin', 'superadmin'), orders.assignRider);
router.put('/orders/:orderId/cancel', protectStaging, orders.cancelOrder);

// Coupons
router.post('/coupons/validate', orders.validateCoupon);
router.get('/coupons', orders.listCoupons);

// Wallet
router.get('/wallet', protectStaging, orders.getWallet);
router.post('/wallet/credit', protectStaging, orders.creditWallet);

// ─── Operational Modules ────────────────────────────────────────────────────
// Delivery Slots
router.get('/delivery-slots/:storeId', operational.getSlots);
router.post('/delivery-slots/book', protectStaging, operational.bookSlot);

// Returns
router.post('/returns', protectStaging, operational.createReturn);
router.get('/returns/store/:storeId', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.getReturnsByStore);

// Reviews
router.post('/reviews', protectStaging, operational.postReview);
router.get('/reviews/product/:productId', operational.getReviewsForProduct);

// Rider SOS & Location
router.post('/sos', protectStaging, requireStagingRole('rider'), operational.triggerSos);
router.get('/sos/store/:storeId', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.getSosByStore);
router.post('/rider/location', protectStaging, requireStagingRole('rider'), operational.updateRiderLocation);

// Remittances
router.post('/remittances', protectStaging, requireStagingRole('rider'), operational.createNewRemittance);
router.put('/remittances/:remittanceId/confirm', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.confirmRemittance);

// Transfers
router.post('/transfers', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.requestTransfer);
router.put('/transfers/:transferId/execute', protectStaging, requireStagingRole('superadmin'), operational.executeTransfer);

// Inventory Defreeze & Waste
router.post('/inventory/:storeId/:itemId/defreeze-transfer', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.transferDefreeze);
router.post('/inventory/:storeId/:itemId/waste', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.recordWaste);

// ─── Staging Namespace (Retained for Test Harness & Backward Compatibility) ───
router.use('/staging', require('./staging/staging.routes'));

module.exports = router;

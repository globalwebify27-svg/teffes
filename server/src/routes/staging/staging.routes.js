/**
 * Staging API Routes
 * Mounts Firestore-backed controllers exclusively for staging/testing.
 * Completely isolated from MongoDB production endpoints.
 */

const { Router } = require('express');
const { protectStaging, requireStagingRole } = require('../../middlewares/stagingAuth');

const auth = require('../../controllers/staging/auth.staging.controller');
const catalog = require('../../controllers/staging/catalog.staging.controller');
const orders = require('../../controllers/staging/orders.staging.controller');
const operational = require('../../controllers/staging/operational.staging.controller');

const router = Router();

// ─── Health / Info ──────────────────────────────────────────────────────────
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    environment: 'staging',
    database: 'Cloud Firestore',
    status: 'Isolated Staging Active',
    timestamp: new Date().toISOString(),
  });
});

// ─── Authentication & Profile ───────────────────────────────────────────────
router.post('/auth/firebase-login', auth.firebaseLogin);
router.post('/auth/admin-login', auth.adminLogin);
router.get('/auth/me', protectStaging, auth.getMe);
router.put('/auth/me', protectStaging, auth.updateMe);

// Addresses
router.get('/auth/addresses', protectStaging, auth.getUserAddresses);
router.post('/auth/addresses', protectStaging, auth.createUserAddress);
router.put('/auth/addresses/:addressId', protectStaging, auth.updateUserAddress);
router.delete('/auth/addresses/:addressId', protectStaging, auth.deleteUserAddress);

// Cart
router.get('/user/cart', protectStaging, auth.getUserCart);
router.post('/user/cart', protectStaging, auth.setUserCart);
router.delete('/user/cart', protectStaging, auth.emptyUserCart);

// Wishlist
router.get('/user/wishlist', protectStaging, auth.getUserWishlist);
router.post('/user/wishlist', protectStaging, auth.toggleUserWishlist);

// ─── Master Data & Catalog ──────────────────────────────────────────────────
router.get('/categories', catalog.getCategories);
router.get('/categories/:slug', catalog.getCategory);
router.get('/banners', catalog.getBanners);
router.get('/settings/seo', catalog.getSeoSettings);
router.get('/cross-sell', catalog.getCrossSell);

// Products
router.get('/products', catalog.listProducts);
router.get('/products/:id', catalog.getProduct);

// Stores & Inventory
router.get('/stores', catalog.listStores);
router.get('/stores/:storeId', catalog.getStore);
router.get('/inventory/:storeId', catalog.getInventoryByStore);
router.get('/inventory/:storeId/:itemId', catalog.getInventoryByItem);

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

// Return Requests
router.post('/returns', protectStaging, operational.createReturn);
router.get('/returns/store/:storeId', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.getReturnsByStore);

// Reviews
router.post('/reviews', protectStaging, operational.postReview);
router.get('/reviews/product/:productId', operational.getReviewsForProduct);

// Rider SOS & Location
router.post('/sos', protectStaging, requireStagingRole('rider'), operational.triggerSos);
router.get('/sos/store/:storeId', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.getSosByStore);
router.post('/rider/location', protectStaging, requireStagingRole('rider'), operational.updateRiderLocation);

// COD Remittances
router.post('/remittances', protectStaging, requireStagingRole('rider'), operational.createNewRemittance);
router.put('/remittances/:remittanceId/confirm', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.confirmRemittance);

// Store Transfers
router.post('/transfers', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.requestTransfer);
router.put('/transfers/:transferId/execute', protectStaging, requireStagingRole('superadmin'), operational.executeTransfer);

// Inventory Defreeze & Waste Management
router.post('/inventory/:storeId/:itemId/defreeze-transfer', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.transferDefreeze);
router.post('/inventory/:storeId/:itemId/waste', protectStaging, requireStagingRole('storeadmin', 'superadmin'), operational.recordWaste);

module.exports = router;

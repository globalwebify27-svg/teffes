const { Router } = require('express');
const { protect, authorize } = require('../middlewares/auth');
const {
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
} = require('../controllers/superAdmin.controller');

const router = Router();

// Protect all super-admin endpoints: strictly allowed for superadmin and admin
router.use(protect, authorize('superadmin', 'admin'));

// 1. Dashboard Overview
router.get('/dashboard', getPlatformDashboard);

// 2. Stores
router.get('/stores', getStores);
router.post('/stores', createStore);
router.put('/stores/:id', updateStore);
router.delete('/stores/:id', deleteStore);

// 3. Store Admins
router.get('/store-admins', getStoreAdmins);
router.post('/store-admins', createStoreAdmin);
router.put('/store-admins/:id', updateStoreAdmin);
router.delete('/store-admins/:id', deleteStoreAdmin);

// 4. Riders
router.get('/riders', getRiders);
router.post('/riders', createRider);

// 5. Customers
router.get('/customers', getPlatformCustomers);

// 6. Coupons
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);

// 7. Orders
router.get('/orders', getAllOrders);

// 8. Settings
router.get('/settings', getSettings);

module.exports = router;

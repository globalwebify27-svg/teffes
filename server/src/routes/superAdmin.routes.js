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
router.put('/riders/:id', updateRider);
router.delete('/riders/:id', deleteRider);

// 5. Customers
router.get('/customers', getPlatformCustomers);

// 6. Coupons
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);
router.put('/coupons/:id/super-offer', setSuperOffer);

// 7. Orders
router.get('/orders', getAllOrders);

// 8. Settings
router.get('/settings', getSettings);

// 9. Hero Banners
const {
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} = require('../controllers/banner.controller');

router.get('/banners', getAllBanners);
router.post('/banners', createBanner);
router.put('/banners/:id', updateBanner);
router.delete('/banners/:id', deleteBanner);

// 10. Categories & Products
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/product.controller');

router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

router.get('/products', getProducts);
router.get('/products/:id', getProductById);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

module.exports = router;

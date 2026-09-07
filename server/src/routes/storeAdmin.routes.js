const { Router } = require('express');
const { protect, authorize } = require('../middlewares/auth');
const {
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
} = require('../controllers/storeAdmin.controller');

const router = Router();

// Protect all store-admin endpoints: allowed for storeadmin, superadmin, admin
router.use(protect, authorize('storeadmin', 'superadmin', 'admin'));

// 1. Dashboard
router.get('/dashboard', getDashboardOverview);

// 2. Orders
router.get('/orders', getOrders);
router.patch('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/assign-rider', assignRiderToOrder);

// 3. Inventory
router.get('/inventory', getInventory);
router.patch('/inventory/:id', updateInventoryItem);

// 4. Customers
router.get('/customers', getStoreCustomers);

// 5. Delivery Slots
router.get('/slots', getDeliverySlots);
router.patch('/slots/:id', updateDeliverySlot);

// 6. Returns & Exchange
router.get('/returns', getReturnRequests);
router.patch('/returns/:id/status', updateReturnStatus);

// 7. Riders
router.get('/riders', getRiders);

module.exports = router;

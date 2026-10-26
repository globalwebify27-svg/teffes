const { Router } = require('express');
const { protect, authorize } = require('../middlewares/auth');
const {
  getDashboardOverview,
  getOrders,
  updateOrderStatus,
  delayPrepTime,
  getInventory,
  updateInventoryItem,
  transferDefreezeStock,
  recordInventoryWaste,
  getInventoryHistory,
  getStoreCustomers,
  getDeliverySlots,
  updateDeliverySlot,
  getReturnRequests,
  updateReturnStatus,
  getRiders,
  assignRiderToOrder,
  getStoreStatus,
  updateStoreStatus,
  getStoreRemittances,
  confirmRemittance,
} = require('../controllers/storeAdmin.controller');

const router = Router();

// Protect all store-admin endpoints: allowed for storeadmin, superadmin, admin
router.use(protect, authorize('storeadmin', 'superadmin', 'admin'));

// Store Live Status & Timings
router.get('/store-status', getStoreStatus);
router.patch('/store-status', updateStoreStatus);

// 1. Dashboard
router.get('/dashboard', getDashboardOverview);

// 2. Orders
router.get('/orders', getOrders);
router.patch('/orders/:id/status', updateOrderStatus);
router.post('/orders/:id/delay-prep', delayPrepTime);
router.patch('/orders/:id/assign-rider', assignRiderToOrder);

// 3. Inventory
router.get('/inventory', getInventory);
router.patch('/inventory/:id', updateInventoryItem);
router.post('/inventory/transfer', transferDefreezeStock);
router.post('/inventory/waste', recordInventoryWaste);
router.get('/inventory/history', getInventoryHistory);

// 4. Customers
router.get('/customers', getStoreCustomers);

// 5. Delivery Slots
router.get('/slots', getDeliverySlots);
router.patch('/slots/:id', updateDeliverySlot);

// 6. Returns & Exchange
router.get('/returns', getReturnRequests);
router.patch('/returns/:id/status', updateReturnStatus);

// 7. Riders & Fleet Remittances
router.get('/riders', getRiders);
router.get('/remittances', getStoreRemittances);
router.patch('/remittances/:id/confirm', confirmRemittance);

// 8. Cross-Selling Items Management
const {
  getAdminCrossSellItems,
  createCrossSellItem,
  updateCrossSellItem,
  deleteCrossSellItem,
} = require('../controllers/crossSell.controller');

router.get('/cross-sell', getAdminCrossSellItems);
router.post('/cross-sell', createCrossSellItem);
router.put('/cross-sell/:id', updateCrossSellItem);
router.patch('/cross-sell/:id', updateCrossSellItem);
router.delete('/cross-sell/:id', deleteCrossSellItem);

module.exports = router;

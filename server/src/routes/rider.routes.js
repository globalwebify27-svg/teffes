const { Router } = require('express');
const {
  getDashboard,
  getDispatchSupport,
  toggleDuty,
  getAvailableOrders,
  acceptOrder,
  rejectOrder,
  confirmPickup,
  updateLocation,
  completeDelivery,
  getEarnings,
  getOrders,
} = require('../controllers/rider.controller');
const { protect } = require('../middlewares/auth');

const router = Router();

// All rider routes require JWT authentication
router.use(protect);

router.get('/dashboard', getDashboard);
router.get('/dispatch-support', getDispatchSupport);
router.post('/duty', toggleDuty);
router.get('/available-orders', getAvailableOrders);
router.post('/orders/:id/accept', acceptOrder);
router.post('/orders/:id/reject', rejectOrder);
router.post('/orders/:id/confirm-pickup', confirmPickup);
router.post('/location', updateLocation);
router.post('/orders/:id/complete-delivery', completeDelivery);
router.get('/earnings', getEarnings);
router.get('/orders', getOrders);

module.exports = router;

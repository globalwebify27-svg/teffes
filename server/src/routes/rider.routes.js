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
  verifyReturnPickup,
  getEarnings,
  getOrders,
  remitCash,
  getRemittanceHistory,
  triggerSosAlert,
  getNotifications,
  markNotificationRead,
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
router.post('/returns/:id/verify-otp', verifyReturnPickup);
router.get('/earnings', getEarnings);
router.get('/orders', getOrders);

// Hub cash remittance
router.post('/remit-cash', remitCash);
router.get('/remittance-history', getRemittanceHistory);

// Emergency SOS alert
router.post('/sos-alert', triggerSosAlert);

// In-app notifications
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationRead);

module.exports = router;

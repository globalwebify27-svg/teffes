const { Router } = require('express');
const { createOrder, verifyPayment, getMyOrders, requestReturn, rateRider, getOrderById } = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth');

const router = Router();

// Order APIs (protected)
router.post('/', protect, createOrder);
router.post('/verify-payment', protect, verifyPayment);
router.get('/my-orders', protect, getMyOrders);
router.get('/:id', protect, getOrderById);
router.post('/:orderId/return', protect, requestReturn);
router.post('/:orderId/rate-rider', protect, rateRider);

module.exports = router;

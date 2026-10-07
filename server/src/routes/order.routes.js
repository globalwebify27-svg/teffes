const { Router } = require('express');
const { createOrder, verifyPayment, getMyOrders, requestReturn } = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth');

const router = Router();

// Order APIs (protected)
router.post('/', protect, createOrder);
router.post('/verify-payment', protect, verifyPayment);
router.get('/my-orders', protect, getMyOrders);
router.post('/:orderId/return', protect, requestReturn);

module.exports = router;

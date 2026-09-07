const { Router } = require('express');
const { protect } = require('../middlewares/auth');
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
} = require('../controllers/payment.controller');

const router = Router();

router.use(protect);

router.post('/create-order', createRazorpayOrder);
router.post('/verify-payment', verifyRazorpayPayment);

module.exports = router;

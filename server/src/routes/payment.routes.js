const { Router } = require('express');
const { protect } = require('../middlewares/auth');
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
} = require('../controllers/payment.controller');

const router = Router();

// Webhook listener MUST NOT be behind JWT authentication
router.post('/webhook', handleRazorpayWebhook);

// Protected routes below
router.use(protect);

router.post('/create-order', createRazorpayOrder);
router.post('/verify-payment', verifyRazorpayPayment);

module.exports = router;

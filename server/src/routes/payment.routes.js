const { Router } = require('express');
const { optionalProtect } = require('../middlewares/auth');
const {
  createPayUOrder,
  verifyPayUPayment,
  handlePayUWebhook,
  generatePayUHash,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
} = require('../controllers/payment.controller');

const router = Router();

// Webhook listener MUST NOT be behind JWT authentication
router.post('/webhook', handlePayUWebhook);

// Payment initiation and hash generation allow both authenticated users & guests
router.use(optionalProtect);

router.post('/create-order', createPayUOrder);
router.post('/verify-payment', verifyPayUPayment);
router.post('/generate-hash', generatePayUHash);

module.exports = router;

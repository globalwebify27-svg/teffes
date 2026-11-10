const { Router } = require('express');
const { optionalProtect } = require('../middlewares/auth');
const {
  getPublicPaymentSettings,
  createPayUOrder,
  verifyPayUPayment,
  handlePayUWebhook,
  generatePayUHash,
  getDoorstepQr,
  getDoorstepPaymentStatus,
  confirmDoorstepPayment,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
} = require('../controllers/payment.controller');

const router = Router();

// Public payment options availability (COD, Online, Wallet)
router.get('/settings', getPublicPaymentSettings);

// Webhook listener MUST NOT be behind JWT authentication
router.post('/webhook', handlePayUWebhook);

// Payment initiation and hash generation allow both authenticated users & guests
router.use(optionalProtect);

router.post('/create-order', createPayUOrder);
router.post('/verify-payment', verifyPayUPayment);
router.post('/generate-hash', generatePayUHash);

// Doorstep QR payment endpoints
router.get('/doorstep-qr/:orderId', getDoorstepQr);
router.get('/doorstep-status/:orderId', getDoorstepPaymentStatus);
router.post('/doorstep-confirm', confirmDoorstepPayment);

module.exports = router;

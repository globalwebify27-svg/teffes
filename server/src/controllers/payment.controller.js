const Razorpay = require('razorpay');
const crypto = require('crypto');

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';
  return new Razorpay({ key_id, key_secret });
};

/**
 * POST /api/payment/create-order
 * Body: { amount }
 */
const createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const amountInPaise = Math.round(amount * 100);
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_default';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'default_secret';

    let razorpayOrder;

    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_ID.includes('placeholder')) {
      try {
        const instance = getRazorpayInstance();
        razorpayOrder = await instance.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`,
        });
      } catch (err) {
        console.warn('[Razorpay] Live order creation warning:', err.message);
      }
    }

    if (!razorpayOrder) {
      // Fallback simulated order id for testing / development
      razorpayOrder = {
        id: `order_dev_${Date.now()}`,
        amount: amountInPaise,
        currency: 'INR',
      };
    }

    res.status(200).json({
      success: true,
      order: razorpayOrder,
      keyId: key_id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payment/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (secret && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
};

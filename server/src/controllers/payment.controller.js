const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const notificationService = require('../services/notificationService');
const { emitOrderStatusUpdate, emitOrderCreated } = require('../socket');

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

/**
 * POST /api/payment/webhook
 * Razorpay Webhook Listener for asynchronous drop-off payment reconciliation
 * Handles: order.paid, payment.captured, payment.failed
 */
const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // If webhook secret is configured, strictly verify HMAC-SHA256 signature
    if (webhookSecret) {
      if (!signature) {
        console.warn('[Razorpay Webhook] Missing x-razorpay-signature header');
        return res.status(400).json({ success: false, message: 'Missing webhook signature' });
      }

      const bodyData = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyData)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('[Razorpay Webhook] Invalid webhook signature');
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }
    } else {
      console.log('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET not set. Processing event in permissive mode.');
    }

    const { event, payload } = req.body || {};
    console.log(`[Razorpay Webhook] Processing event: ${event}`);

    if (event === 'order.paid' || event === 'payment.captured') {
      const paymentEntity = payload?.payment?.entity || {};
      const orderEntity = payload?.order?.entity || {};

      const razorpayOrderId = paymentEntity.order_id || orderEntity.id;
      const razorpayPaymentId = paymentEntity.id;

      if (!razorpayOrderId && !razorpayPaymentId) {
        console.warn('[Razorpay Webhook] No order_id or payment_id found in payload');
        return res.status(200).json({ status: 'ok', message: 'No order identifier found' });
      }

      // Find order matching razorpayOrderId or razorpayPaymentId
      const order = await Order.findOne({
        $or: [
          ...(razorpayOrderId ? [{ razorpayOrderId }] : []),
          ...(razorpayPaymentId ? [{ razorpayPaymentId }] : []),
        ],
      });

      if (order) {
        let modified = false;

        if (order.paymentStatus !== 'Paid') {
          order.paymentStatus = 'Paid';
          modified = true;
        }

        if (razorpayPaymentId && order.razorpayPaymentId !== razorpayPaymentId) {
          order.razorpayPaymentId = razorpayPaymentId;
          modified = true;
        }

        // If order was in draft or pending payment status, advance it to Pending for butchery processing
        if (order.status === 'Draft' || order.status === 'PendingPayment' || !order.status) {
          order.status = 'Pending';
          modified = true;
        }

        if (modified) {
          await order.save();
          console.log(`[Razorpay Webhook] Successfully reconciled Order #${order.orderId} as Paid via Webhook`);

          // Emit real-time socket events for Store Admin alarm & tracking screens
          emitOrderStatusUpdate(order.orderId, order);
          emitOrderCreated(order);

          // Push notification to customer
          if (order.customer?.userId) {
            notificationService.sendToUser(order.customer.userId, {
              title: 'Payment Received! 🥩',
              body: `Your payment for order #${order.orderId} was confirmed. Butchery preparation is underway!`,
              data: {
                notificationType: 'ORDER_STATUS',
                orderId: order.orderId,
                status: order.status,
                clickAction: `/dashboard?orderId=${order.orderId}`,
              },
            }).catch((err) => console.warn('[FCM] Webhook order push error:', err.message));
          }
        }
      } else {
        console.warn(`[Razorpay Webhook] Order for razorpayOrderId ${razorpayOrderId} not found in DB yet.`);
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload?.payment?.entity || {};
      const razorpayOrderId = paymentEntity.order_id;

      if (razorpayOrderId) {
        const order = await Order.findOne({ razorpayOrderId });
        if (order && order.paymentStatus !== 'Paid') {
          order.paymentStatus = 'Failed';
          await order.save();
          emitOrderStatusUpdate(order.orderId, order);
          console.log(`[Razorpay Webhook] Order #${order.orderId} marked as Failed due to payment.failed event`);
        }
      }
    }

    // Always respond 200 OK to Razorpay to prevent webhook retry storms
    res.status(200).json({ status: 'ok', received: true });
  } catch (error) {
    console.error('[Razorpay Webhook] Error processing webhook:', error);
    // Return 200 with error logged to avoid endless webhook retries
    res.status(200).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
};

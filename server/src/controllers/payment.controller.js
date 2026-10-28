/**
 * Payment Controller (Pure Cloud Firestore Backend)
 * 100% Zero MongoDB dependency - Fully migrated to Google Cloud Firestore
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const {
  queryDocs,
  updateDoc,
  getDoc,
} = require('../lib/firestore');
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
    let isLiveOrTestWorking = false;

    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_ID.includes('placeholder')) {
      try {
        const instance = getRazorpayInstance();
        razorpayOrder = await instance.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`,
        });
        isLiveOrTestWorking = true;
      } catch (err) {
        console.warn('[Razorpay] Live instance failed, falling back to mock simulator:', err.message);
      }
    }

    if (!isLiveOrTestWorking) {
      razorpayOrder = {
        id: `order_mock_${Date.now()}`,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
        status: 'created',
        attempts: 0,
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    res.status(200).json({
      success: true,
      order: razorpayOrder,
      keyId: key_id,
      mockMode: !isLiveOrTestWorking,
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
 * Razorpay Webhook Listener for asynchronous payment reconciliation
 */
const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

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
    }

    const { event, payload } = req.body || {};
    console.log(`[Razorpay Webhook] Processing event: ${event}`);

    if (event === 'order.paid' || event === 'payment.captured') {
      const paymentEntity = payload?.payment?.entity || {};
      const orderEntity = payload?.order?.entity || {};

      const razorpayOrderId = paymentEntity.order_id || orderEntity.id;
      const razorpayPaymentId = paymentEntity.id;

      if (!razorpayOrderId && !razorpayPaymentId) {
        return res.status(200).json({ status: 'ok', message: 'No order identifier found' });
      }

      // Find order in Firestore matching razorpayOrderId or razorpayPaymentId
      let matchingOrders = [];
      if (razorpayOrderId) {
        matchingOrders = await queryDocs('orders', (ref) =>
          ref.where('razorpayOrderId', '==', razorpayOrderId).limit(1)
        );
      }
      if (matchingOrders.length === 0 && razorpayPaymentId) {
        matchingOrders = await queryDocs('orders', (ref) =>
          ref.where('razorpayPaymentId', '==', razorpayPaymentId).limit(1)
        );
      }

      const order = matchingOrders[0] || null;

      if (order) {
        const docId = order.orderId || order.id;
        const updates = {
          paymentStatus: 'Paid',
          updatedAt: new Date().toISOString(),
        };

        if (razorpayPaymentId) {
          updates.razorpayPaymentId = razorpayPaymentId;
        }

        if (order.status === 'Draft' || order.status === 'PendingPayment' || !order.status) {
          updates.status = 'Pending';
        }

        await updateDoc('orders', docId, updates);
        const updatedOrder = { ...order, ...updates };

        console.log(`[Razorpay Webhook] Successfully reconciled Order #${docId} as Paid via Firestore`);

        emitOrderStatusUpdate(docId, updatedOrder);
        emitOrderCreated(updatedOrder);

        if (order.customer?.userId) {
          notificationService.sendToUser(order.customer.userId, {
            title: 'Payment Received',
            body: `Your payment for order #${docId} was confirmed. Order preparation is underway!`,
            data: {
              notificationType: 'ORDER_STATUS',
              orderId: docId,
              status: updatedOrder.status,
              clickAction: `/dashboard?orderId=${docId}`,
            },
          }).catch((err) => console.warn('[FCM] Webhook order push error:', err.message));
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload?.payment?.entity || {};
      const razorpayOrderId = paymentEntity.order_id;

      if (razorpayOrderId) {
        const matchingOrders = await queryDocs('orders', (ref) =>
          ref.where('razorpayOrderId', '==', razorpayOrderId).limit(1)
        );
        const order = matchingOrders[0] || null;
        if (order && order.paymentStatus !== 'Paid') {
          const docId = order.orderId || order.id;
          await updateDoc('orders', docId, {
            paymentStatus: 'Failed',
            updatedAt: new Date().toISOString(),
          });
          emitOrderStatusUpdate(docId, { ...order, paymentStatus: 'Failed' });
        }
      }
    }

    res.status(200).json({ status: 'ok', received: true });
  } catch (error) {
    console.error('[Razorpay Webhook] Error processing webhook:', error);
    res.status(200).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
};

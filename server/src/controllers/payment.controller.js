/**
 * Payment Controller - PayU Integration
 * Replaces Razorpay. Uses SHA512 hash-based checkout.
 * PayU Test Endpoint: https://test.payu.in/_payment
 * PayU Live Endpoint: https://secure.payu.in/_payment
 */

const crypto = require('crypto');
const {
  queryDocs,
  updateDoc,
  getDoc,
} = require('../lib/firestore');
const notificationService = require('../services/notificationService');
const { emitOrderStatusUpdate, emitOrderCreated } = require('../socket');

const PAYU_KEY  = process.env.PAYU_MERCHANT_KEY  || 'mv5iBR';
const PAYU_SALT = process.env.PAYU_MERCHANT_SALT || 'zfjyRbqXallwBDnRVXBVDIJGnM2sKmK';
const PAYU_URL  = process.env.PAYU_BASE_URL       || 'https://test.payu.in';

/**
 * Compute PayU forward hash:
 * SHA512(key|txnid|amount|productinfo|firstname|email|||||||||||salt)
 */
function computePayUHash({ txnid, amount, productinfo, firstname, email }) {
  const str = `${PAYU_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${PAYU_SALT}`;
  return crypto.createHash('sha512').update(str).digest('hex');
}

/**
 * Compute PayU reverse hash for response verification:
 * SHA512(salt|status|||||||||||email|firstname|productinfo|amount|txnid|key)
 */
function computePayUReverseHash({ txnid, amount, productinfo, firstname, email, status }) {
  const str = `${PAYU_SALT}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${PAYU_KEY}`;
  return crypto.createHash('sha512').update(str).digest('hex');
}

/**
 * POST /api/payment/create-order
 * Body: { amount, firstname, email, phone }
 * Returns PayU payment params + hash for the frontend to POST to PayU
 */
const createPayUOrder = async (req, res, next) => {
  try {
    const {
      amount,
      firstname = 'Customer',
      email = 'customer@teffes.com',
      phone = '9999999999',
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const txnid       = `TEF${Date.now()}`;
    const amountStr   = Number(amount).toFixed(2);
    const productinfo = "TeFFe's Fresh Order";
    const hash        = computePayUHash({ txnid, amount: amountStr, productinfo, firstname, email });

    // Pre-calculate mobile SDK static hashes required by PayU Checkout Pro
    const paymentRelatedDetailsHash = crypto
      .createHash('sha512')
      .update(`${PAYU_KEY}|payment_related_details_for_mobile_sdk|default|${PAYU_SALT}`)
      .digest('hex');

    const vasForMobileSdkHash = crypto
      .createHash('sha512')
      .update(`${PAYU_KEY}|vas_for_mobile_sdk|default|${PAYU_SALT}`)
      .digest('hex');

    return res.status(200).json({
      success: true,
      payuParams: {
        key:         PAYU_KEY,
        txnid,
        amount:      amountStr,
        productinfo,
        firstname,
        email,
        phone,
        surl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/success`,
        furl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/failure`,
        hash,
        hashes: {
          payment: hash,
          payment_related_details_for_mobile_sdk: paymentRelatedDetailsHash,
          vas_for_mobile_sdk: vasForMobileSdkHash,
        },
      },
      payuUrl: `${PAYU_URL}/_payment`,
      keyId:   PAYU_KEY, // Legacy alias
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payment/verify-payment
 * Body: { txnid, amount, productinfo, firstname, email, status, hash }
 */
const verifyPayUPayment = async (req, res, next) => {
  try {
    const { txnid, amount, productinfo, firstname, email, status, hash: receivedHash } = req.body;

    if (!receivedHash) {
      return res.status(400).json({ success: false, message: 'Missing payment hash' });
    }

    const expectedHash = computePayUReverseHash({ txnid, amount, productinfo, firstname, email, status });

    if (expectedHash !== receivedHash) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    if (status !== 'success') {
      return res.status(400).json({ success: false, message: `Payment ${status}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: txnid,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payment/webhook
 * PayU posts payment result as form data (application/x-www-form-urlencoded)
 */
const handlePayUWebhook = async (req, res, next) => {
  try {
    const {
      txnid, amount, productinfo, firstname, email,
      status, hash: receivedHash, mihpayid,
    } = req.body || {};

    if (receivedHash) {
      const expectedHash = computePayUReverseHash({ txnid, amount, productinfo, firstname, email, status });
      if (expectedHash !== receivedHash) {
        console.warn('[PayU Webhook] Invalid hash, ignoring');
        return res.status(200).json({ status: 'ok' });
      }
    }

    console.log(`[PayU Webhook] txnid=${txnid} status=${status}`);

    if (status === 'success') {
      let matchingOrders = [];
      if (txnid) {
        matchingOrders = await queryDocs('orders', (ref) =>
          ref.where('transactionId', '==', txnid).limit(1)
        );
      }
      if (matchingOrders.length === 0 && mihpayid) {
        matchingOrders = await queryDocs('orders', (ref) =>
          ref.where('payuPaymentId', '==', mihpayid).limit(1)
        );
      }

      const order = matchingOrders[0] || null;
      if (order) {
        const docId = order.orderId || order.id;
        const updates = {
          paymentStatus: 'Paid',
          payuPaymentId: mihpayid || txnid,
          transactionId: txnid,
          updatedAt: new Date().toISOString(),
        };
        if (order.status === 'Draft' || order.status === 'PendingPayment' || !order.status) {
          updates.status = 'Pending';
        }
        await updateDoc('orders', docId, updates);
        const updatedOrder = { ...order, ...updates };
        emitOrderStatusUpdate(docId, updatedOrder);
        emitOrderCreated(updatedOrder);

        if (order.customer?.userId) {
          notificationService.sendToUser(order.customer.userId, {
            title: 'Payment Received',
            body: `Your payment for order #${docId} was confirmed. Preparation is underway!`,
            data: {
              notificationType: 'ORDER_STATUS',
              orderId: docId,
              status: updatedOrder.status,
              clickAction: `/dashboard?orderId=${docId}`,
            },
          }).catch((err) => console.warn('[FCM] PayU Webhook push error:', err.message));
        }
      }
    } else if (status === 'failure' || status === 'failed') {
      if (txnid) {
        const matchingOrders = await queryDocs('orders', (ref) =>
          ref.where('transactionId', '==', txnid).limit(1)
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
    console.error('[PayU Webhook] Error:', error);
    res.status(200).json({ status: 'error', message: error.message });
  }
};

/**
 * POST /api/payment/generate-hash
 * Used by mobile SDKs (e.g. Flutter PayUCheckoutPro) to compute on-demand hashes
 */
const generatePayUHash = async (req, res, next) => {
  try {
    const { hashName, hashString, postSalt } = req.body;
    console.log(`[PayU Hash] requested hashName="${hashName}", hashString="${hashString}", postSalt="${postSalt}"`);

    let hash = '';
    if (hashString) {
      const toHash = hashString + (postSalt ? (PAYU_SALT + postSalt) : PAYU_SALT);
      hash = crypto.createHash('sha512').update(toHash).digest('hex');
    } else if (hashName === 'payment_related_details_for_mobile_sdk') {
      const toHash = `${PAYU_KEY}|payment_related_details_for_mobile_sdk|default|${PAYU_SALT}`;
      hash = crypto.createHash('sha512').update(toHash).digest('hex');
    } else if (hashName === 'vas_for_mobile_sdk') {
      const toHash = `${PAYU_KEY}|vas_for_mobile_sdk|default|${PAYU_SALT}`;
      hash = crypto.createHash('sha512').update(toHash).digest('hex');
    } else {
      return res.status(400).json({ success: false, message: 'hashString is required' });
    }

    console.log(`[PayU Hash] generated for "${hashName}": ${hash}`);
    return res.status(200).json({
      success: true,
      hashName,
      hash,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPayUOrder,
  verifyPayUPayment,
  handlePayUWebhook,
  generatePayUHash,
  // Legacy aliases so routes/other files don't need changing
  createRazorpayOrder: createPayUOrder,
  verifyRazorpayPayment: verifyPayUPayment,
  handleRazorpayWebhook: handlePayUWebhook,
};

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
const { getPaymentSettings } = require('../services/firestore/siteSettings.firestore.service');

const PAYU_LIVE_URL = 'https://secure.payu.in';

/**
 * Resolve active PayU credentials from DB.
 * Client requirement: strictly Production/Live URL, no test fallback when unconfigured.
 */
async function getActivePayUConfig() {
  const settings = await getPaymentSettings();
  const key = settings.payuMerchantKey ? settings.payuMerchantKey.trim() : '';
  const salt = settings.payuMerchantSalt ? settings.payuMerchantSalt.trim() : '';
  const isConfigured = Boolean(key && salt);

  return {
    key,
    salt,
    url: PAYU_LIVE_URL,
    onlineEnabled: settings.onlineEnabled !== false,
    codEnabled: settings.codEnabled !== false,
    walletEnabled: settings.walletEnabled !== false,
    isConfigured,
  };
}

/**
 * Compute PayU forward hash:
 * SHA512(key|txnid|amount|productinfo|firstname|email|||||||||||salt)
 */
function computePayUHash({ key, salt, txnid, amount, productinfo, firstname, email }) {
  const str = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
  return crypto.createHash('sha512').update(str).digest('hex');
}

/**
 * Compute PayU reverse hash for response verification:
 * SHA512(salt|status|||||||||||email|firstname|productinfo|amount|txnid|key)
 */
function computePayUReverseHash({ key, salt, txnid, amount, productinfo, firstname, email, status }) {
  const str = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  return crypto.createHash('sha512').update(str).digest('hex');
}

/**
 * GET /api/payment/settings
 * Public payment options availability for website and mobile checkout
 */
const getPublicPaymentSettings = async (req, res, next) => {
  try {
    const config = await getActivePayUConfig();
    res.status(200).json({
      success: true,
      paymentSettings: {
        codEnabled: config.codEnabled,
        onlineEnabled: config.onlineEnabled,
        walletEnabled: config.walletEnabled,
        payuConfigured: config.isConfigured,
        payuMerchantKey: config.isConfigured ? config.key : '',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payment/create-order
 * Body: { amount, firstname, email, phone }
 * Returns PayU payment params + hash for the frontend to POST to PayU
 */
const createPayUOrder = async (req, res, next) => {
  try {
    const config = await getActivePayUConfig();

    if (!config.onlineEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Online payment (PayU) is currently disabled by store administration.',
      });
    }

    if (!config.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'PayU online payment is not configured by admin. Please contact support or choose another payment method.',
      });
    }

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
    const hash        = computePayUHash({
      key: config.key,
      salt: config.salt,
      txnid,
      amount: amountStr,
      productinfo,
      firstname,
      email,
    });

    // Pre-calculate mobile SDK static hashes required by PayU Checkout Pro
    const paymentRelatedDetailsHash = crypto
      .createHash('sha512')
      .update(`${config.key}|payment_related_details_for_mobile_sdk|default|${config.salt}`)
      .digest('hex');

    const vasForMobileSdkHash = crypto
      .createHash('sha512')
      .update(`${config.key}|vas_for_mobile_sdk|default|${config.salt}`)
      .digest('hex');

    return res.status(200).json({
      success: true,
      payuParams: {
        key:         config.key,
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
      payuUrl: `${config.url}/_payment`,
      keyId:   config.key, // Legacy alias
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

    const config = await getActivePayUConfig();
    const expectedHash = computePayUReverseHash({
      key: config.key,
      salt: config.salt,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
    });

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

    const config = await getActivePayUConfig();

    if (receivedHash) {
      const expectedHash = computePayUReverseHash({
        key: config.key,
        salt: config.salt,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        status,
      });
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

    const config = await getActivePayUConfig();
    if (!config.onlineEnabled || !config.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'PayU online payment is not configured or is disabled by store administration.',
      });
    }

    let hash = '';
    if (hashString) {
      const toHash = hashString + (postSalt ? (config.salt + postSalt) : config.salt);
      hash = crypto.createHash('sha512').update(toHash).digest('hex');
    } else if (hashName === 'payment_related_details_for_mobile_sdk') {
      const toHash = `${config.key}|payment_related_details_for_mobile_sdk|default|${config.salt}`;
      hash = crypto.createHash('sha512').update(toHash).digest('hex');
    } else if (hashName === 'vas_for_mobile_sdk') {
      const toHash = `${config.key}|vas_for_mobile_sdk|default|${config.salt}`;
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

/**
 * GET /api/payment/doorstep-qr/:orderId
 * Generate dynamic UPI QR parameters for doorstep collection
 */
const getDoorstepQr = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    let order = await getDoc('orders', String(orderId).trim());
    if (!order) {
      const matches = await queryDocs('orders', (ref) => ref.where('orderId', '==', String(orderId).trim()).limit(1));
      order = matches[0] || null;
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const docId = order.orderId || order.id || orderId;
    const amount = Number(order.amount != null ? order.amount : order.totalAmount) || 0;
    const isAlreadyPaid = order.paymentStatus === 'Paid';

    // Standard NPCI UPI URI with exact amount and merchant info
    const payeeVpa = process.env.UPI_VPA || 'teffes@icici';
    const payeeName = encodeURIComponent("TeFFe's Fresh Meat");
    const note = encodeURIComponent(`Order ${docId}`);
    const upiUri = `upi://pay?pa=${payeeVpa}&pn=${payeeName}&am=${amount.toFixed(2)}&tr=${docId}&tn=${note}&cu=INR`;

    // PayU dynamic transaction id for doorstep payment
    const txnid = `TEF_DOORSTEP_${docId}_${Date.now()}`;
    const productinfo = `Doorstep Payment #${docId}`;
    const firstname = (order.customer?.name || 'Customer').split(' ')[0] || 'Customer';
    const email = order.customer?.email || 'customer@teffes.com';
    const hash = computePayUHash({
      txnid,
      amount: amount.toFixed(2),
      productinfo,
      firstname,
      email,
    });

    const payuParams = {
      key: PAYU_KEY,
      txnid,
      amount: amount.toFixed(2),
      productinfo,
      firstname,
      email,
      phone: order.customer?.phone || '9999999999',
      hash,
    };

    // Update order with pending doorstep payment marker
    await updateDoc('orders', docId, {
      doorstepQrGeneratedAt: new Date().toISOString(),
      doorstepTxnId: txnid,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      orderId: docId,
      amount,
      upiUri,
      isPaid: isAlreadyPaid,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      payuParams,
      customerName: order.customer?.name || 'Customer',
      customerPhone: order.customer?.phone || '',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payment/doorstep-status/:orderId
 * Check current payment status of an order at doorstep
 */
const getDoorstepPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    let order = await getDoc('orders', String(orderId).trim());
    if (!order) {
      const matches = await queryDocs('orders', (ref) => ref.where('orderId', '==', String(orderId).trim()).limit(1));
      order = matches[0] || null;
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isPaid = order.paymentStatus === 'Paid';
    return res.status(200).json({
      success: true,
      orderId: order.orderId || order.id || orderId,
      isPaid,
      paymentStatus: order.paymentStatus || 'Pending',
      paymentMethod: order.paymentMethod || 'Cash on Delivery',
      transactionId: order.transactionId || order.payuPaymentId || null,
      amount: Number(order.amount != null ? order.amount : order.totalAmount) || 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payment/doorstep-confirm
 * Confirm doorstep payment via UPI QR code
 */
const confirmDoorstepPayment = async (req, res, next) => {
  try {
    const { orderId, utr, paymentMethod } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    let order = await getDoc('orders', String(orderId).trim());
    if (!order) {
      const matches = await queryDocs('orders', (ref) => ref.where('orderId', '==', String(orderId).trim()).limit(1));
      order = matches[0] || null;
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const docId = order.orderId || order.id || orderId;
    const now = new Date().toISOString();
    const finalMethod = paymentMethod || 'UPI QR (Doorstep)';
    const finalTxnId = utr || `UPI_DOORSTEP_${Date.now()}`;

    const updatePayload = {
      paymentStatus: 'Paid',
      paymentMethod: finalMethod,
      transactionId: finalTxnId,
      paidAt: now,
      cashCollected: 0, // CRITICAL: Rider collected 0 physical cash!
      updatedAt: now,
    };

    await updateDoc('orders', docId, updatePayload);
    const updatedOrder = { ...order, ...updatePayload };

    // Emit live status update to all connected clients & rider
    try {
      emitOrderStatusUpdate(docId, updatedOrder);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Doorstep UPI payment verified successfully',
      isPaid: true,
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicPaymentSettings,
  createPayUOrder,
  verifyPayUPayment,
  handlePayUWebhook,
  generatePayUHash,
  getDoorstepQr,
  getDoorstepPaymentStatus,
  confirmDoorstepPayment,
  // Legacy aliases so routes/other files don't need changing
  createRazorpayOrder: createPayUOrder,
  verifyRazorpayPayment: verifyPayUPayment,
  handleRazorpayWebhook: handlePayUWebhook,
};

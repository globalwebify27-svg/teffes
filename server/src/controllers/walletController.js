const crypto = require('crypto');
const { getDoc, createDoc, updateDoc, queryDocs } = require('../lib/firestore');
const { getUserById } = require('../services/firestore/user.firestore.service');
const { getPaymentSettings } = require('../services/firestore/siteSettings.firestore.service');

const PAYU_LIVE_URL = 'https://secure.payu.in';

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
    isConfigured,
  };
}

function computePayUHash({ key, salt, txnid, amount, productinfo, firstname, email }) {
  const str = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
  return crypto.createHash('sha512').update(str).digest('hex');
}

function computePayUReverseHash({ key, salt, txnid, amount, productinfo, firstname, email, status }) {
  const str = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  return crypto.createHash('sha512').update(str).digest('hex');
}

// Get wallet balance and transactions (Pure Firestore)
exports.getWalletDetails = async (req, res, next) => {
  try {
    const userId = String(req.user?.id || req.user?._id);
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const transactions = await queryDocs('wallet_transactions', (ref) =>
      ref.where('userId', '==', userId)
    );
    transactions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.status(200).json({
      success: true,
      balance: user.walletBalance || 0,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

// Add money to wallet (user top-up or refund) (Pure Firestore)
exports.addMoney = async (req, res, next) => {
  try {
    const { amount, description, orderId } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const userId = String(req.user?.id || req.user?._id);
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newBalance = Math.round(((user.walletBalance || 0) + numAmount) * 100) / 100;
    const now = new Date().toISOString();
    await updateDoc('users', userId, {
      walletBalance: newBalance,
      updatedAt: now,
    });

    const txnId = `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const transaction = {
      id: txnId,
      _id: txnId,
      userId,
      type: 'Credit',
      amount: numAmount,
      balanceAfter: newBalance,
      description: description || 'Money added to wallet',
      orderId: orderId || null,
      status: 'Success',
      createdAt: now,
    };
    await createDoc('wallet_transactions', txnId, transaction);

    try {
      const { emitWalletUpdate } = require('../socket');
      emitWalletUpdate(userId, newBalance, transaction);
    } catch (socketErr) {
      console.warn('[Socket.IO] Wallet update emit warn:', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Money added successfully',
      balance: newBalance,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

// Super Admin adding money to a specific user (Pure Firestore)
exports.addMoneyToUser = async (req, res, next) => {
  try {
    const { userId, amount, description } = req.body;
    const numAmount = Number(amount);

    if (!userId || !numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid userId and amount are required' });
    }

    const targetUserId = String(userId);
    const user = await getUserById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newBalance = Math.round(((user.walletBalance || 0) + numAmount) * 100) / 100;
    const now = new Date().toISOString();
    await updateDoc('users', targetUserId, {
      walletBalance: newBalance,
      updatedAt: now,
    });

    const txnId = `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const transaction = {
      id: txnId,
      _id: txnId,
      userId: targetUserId,
      type: 'Credit',
      amount: numAmount,
      balanceAfter: newBalance,
      description: description || 'Money added by Super Admin',
      status: 'Success',
      createdAt: now,
    };
    await createDoc('wallet_transactions', txnId, transaction);

    try {
      const { emitWalletUpdate } = require('../socket');
      emitWalletUpdate(targetUserId, newBalance, transaction);
    } catch (socketErr) {
      console.warn('[Socket.IO] Wallet update emit warn:', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Successfully added ₹${numAmount} to ${user.name || 'User'}`,
      balance: newBalance,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/wallet/create-order
 * Create PayU order params for wallet top-up
 */
exports.createWalletTopupOrder = async (req, res, next) => {
  try {
    const config = await getActivePayUConfig();

    if (!config.onlineEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Online wallet recharge is currently disabled by store administration.',
      });
    }

    if (!config.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'PayU online payment is not configured by admin. Please contact support.',
      });
    }

    const { amount, firstname = 'Customer', email = 'customer@teffes.com', phone = '9999999999' } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid recharge amount is required' });
    }

    const txnid       = `WAL${Date.now()}`;
    const amountStr   = numAmount.toFixed(2);
    const productinfo = "TeFFe's Wallet Recharge";
    const hash        = computePayUHash({
      key: config.key,
      salt: config.salt,
      txnid,
      amount: amountStr,
      productinfo,
      firstname,
      email,
    });

    res.status(200).json({
      success: true,
      payuParams: {
        key:         config.key,
        txnid,
        amount:      amountStr,
        productinfo,
        firstname,
        email,
        phone,
        surl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/wallet-success`,
        furl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/wallet-failure`,
        hash,
      },
      payuUrl: `${config.url}/_payment`,
      keyId:   config.key,
      amount:  numAmount,
      isSimulation: false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/wallet/verify-topup
 * Verifies PayU wallet recharge and credits wallet (Pure Firestore)
 */
exports.verifyWalletTopup = async (req, res, next) => {
  try {
    const { txnid, amount, productinfo, firstname, email, status, hash: receivedHash, mihpayid } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid recharge amount' });
    }

    const config = await getActivePayUConfig();

    // Verify PayU reverse hash
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
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
    }

    if (status && status !== 'success') {
      return res.status(400).json({ success: false, message: `Payment ${status}` });
    }

    const userId = String(req.user?.id || req.user?._id);
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newBalance = Math.round(((user.walletBalance || 0) + numAmount) * 100) / 100;
    const now = new Date().toISOString();
    await updateDoc('users', userId, {
      walletBalance: newBalance,
      updatedAt: now,
    });

    const txnId = `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const transaction = {
      id: txnId,
      _id: txnId,
      userId,
      type: 'Credit',
      amount: numAmount,
      balanceAfter: newBalance,
      description: `Online Wallet Recharge via PayU (${mihpayid || txnid || 'UPI/Card'})`,
      transactionId: txnid || null,
      payuPaymentId: mihpayid || null,
      status: 'Success',
      createdAt: now,
    };
    await createDoc('wallet_transactions', txnId, transaction);

    try {
      const { emitWalletUpdate } = require('../socket');
      emitWalletUpdate(userId, newBalance, transaction);
    } catch (socketErr) {
      console.warn('[Socket.IO] Wallet topup emit warn:', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: `₹${numAmount} successfully added to your wallet!`,
      balance: newBalance,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

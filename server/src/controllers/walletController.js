const Razorpay = require('razorpay');
const crypto = require('crypto');
const { getDoc, createDoc, updateDoc, queryDocs } = require('../lib/firestore');
const { getUserById } = require('../services/firestore/user.firestore.service');

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';
  return new Razorpay({ key_id, key_secret });
};

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
 * Create Razorpay order for wallet top-up
 */
exports.createWalletTopupOrder = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid recharge amount is required' });
    }

    const amountInPaise = Math.round(numAmount * 100);
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';

    let razorpayOrder;
    let isLiveOrTestWorking = false;
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_ID.includes('placeholder')) {
      try {
        const instance = getRazorpayInstance();
        razorpayOrder = await instance.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `wal_${Date.now()}`,
          notes: {
            type: 'wallet_topup',
            userId: String(req.user?.id || req.user?._id),
          },
        });
        isLiveOrTestWorking = true;
      } catch (err) {
        console.warn('[Razorpay Wallet] Live order creation warning:', err.message);
      }
    }

    if (!razorpayOrder) {
      razorpayOrder = {
        id: `order_wal_dev_${Date.now()}`,
        amount: amountInPaise,
        currency: 'INR',
      };
    }

    res.status(200).json({
      success: true,
      order: razorpayOrder,
      keyId: isLiveOrTestWorking ? key_id : null,
      isSimulation: !isLiveOrTestWorking,
      amount: numAmount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/wallet/verify-topup
 * (Pure Firestore)
 */
exports.verifyWalletTopup = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid recharge amount' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (secret && razorpay_signature && !secret.includes('placeholder')) {
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
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
      description: `Online Wallet Recharge via Razorpay (${razorpay_payment_id || 'UPI/Card'})`,
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

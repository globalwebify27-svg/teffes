const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';
  return new Razorpay({ key_id, key_secret });
};

// Get wallet balance and transactions
exports.getWalletDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('walletBalance');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const transactions = await WalletTransaction.find({ userId: req.user._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      balance: user.walletBalance,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

// Add money to wallet (for promotional or refund purposes by admin, or user top-up)
// This is a basic implementation for now.
exports.addMoney = async (req, res, next) => {
  try {
    const { amount, description, orderId } = req.body;
    
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.walletBalance = (user.walletBalance || 0) + numAmount;
    await user.save();

    const transaction = await WalletTransaction.create({
      userId: user._id,
      type: 'Credit',
      amount: numAmount,
      description: description || 'Money added to wallet',
      orderId: orderId || null,
      status: 'Success'
    });

    try {
      const { emitWalletUpdate } = require('../socket');
      emitWalletUpdate(user._id, user.walletBalance, transaction);
    } catch (socketErr) {
      console.warn('[Socket.IO] Wallet update emit warn:', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Money added successfully',
      balance: user.walletBalance,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};
// Super Admin adding money to a specific user
exports.addMoneyToUser = async (req, res, next) => {
  try {
    const { userId, amount, description } = req.body;
    const numAmount = Number(amount);
    
    if (!userId || !numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid userId and amount are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.walletBalance = (user.walletBalance || 0) + numAmount;
    await user.save();

    const transaction = await WalletTransaction.create({
      userId: user._id,
      type: 'Credit',
      amount: numAmount,
      description: description || 'Money added by Super Admin',
      status: 'Success'
    });

    try {
      const { emitWalletUpdate } = require('../socket');
      emitWalletUpdate(user._id, user.walletBalance, transaction);
    } catch (socketErr) {
      console.warn('[Socket.IO] Wallet update emit warn:', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Successfully added ₹${numAmount} to ${user.name || 'User'}`,
      balance: user.walletBalance,
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
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';

    let razorpayOrder;
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_ID.includes('placeholder')) {
      try {
        const instance = getRazorpayInstance();
        razorpayOrder = await instance.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `wal_${Date.now()}`,
          notes: {
            type: 'wallet_topup',
            userId: req.user._id.toString(),
          },
        });
      } catch (err) {
        console.warn('[Razorpay Wallet] Live order creation warning:', err.message);
      }
    }

    if (!razorpayOrder) {
      // Fallback simulated order id for testing / development
      razorpayOrder = {
        id: `order_wal_dev_${Date.now()}`,
        amount: amountInPaise,
        currency: 'INR',
      };
    }

    res.status(200).json({
      success: true,
      order: razorpayOrder,
      keyId: key_id,
      amount: numAmount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/wallet/verify-topup
 * Verify Razorpay payment signature and credit wallet balance
 */
exports.verifyWalletTopup = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid recharge amount' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    // Verify Razorpay signature if live secret is available
    if (secret && razorpay_signature && !secret.includes('placeholder')) {
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.walletBalance = (user.walletBalance || 0) + numAmount;
    await user.save();

    const transaction = await WalletTransaction.create({
      userId: user._id,
      type: 'Credit',
      amount: numAmount,
      description: `Online Wallet Recharge via Razorpay (${razorpay_payment_id || 'UPI/Card'})`,
      status: 'Success',
    });

    try {
      const { emitWalletUpdate } = require('../socket');
      emitWalletUpdate(user._id, user.walletBalance, transaction);
    } catch (socketErr) {
      console.warn('[Socket.IO] Wallet topup emit warn:', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: `₹${numAmount} successfully added to your wallet!`,
      balance: user.walletBalance,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

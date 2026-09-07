const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

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

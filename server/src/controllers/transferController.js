const StoreTransfer = require('../models/StoreTransfer');
const Store = require('../models/Store');

// Request a transfer from another store
exports.requestTransfer = async (req, res, next) => {
  try {
    const { fromStoreId, items, notes } = req.body;
    const toStoreId = req.user.storeId; // Requesting store

    if (!toStoreId) {
      return res.status(403).json({ success: false, message: 'You are not assigned to a store.' });
    }

    if (!fromStoreId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'From Store ID and items are required.' });
    }

    const transfer = await StoreTransfer.create({
      fromStoreId,
      toStoreId,
      items,
      requestedBy: req.user._id,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Transfer requested successfully',
      transfer,
    });
  } catch (error) {
    next(error);
  }
};

// Get transfers for my store
exports.getStoreTransfers = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    if (!storeId) {
      return res.status(403).json({ success: false, message: 'You are not assigned to a store.' });
    }

    const inbound = await StoreTransfer.find({ toStoreId: storeId }).populate('requestedBy', 'name').sort({ createdAt: -1 });
    const outbound = await StoreTransfer.find({ fromStoreId: storeId }).populate('requestedBy', 'name').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      inbound,
      outbound,
    });
  } catch (error) {
    next(error);
  }
};

// Update transfer status
exports.updateTransferStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const storeId = req.user.storeId;

    const transfer = await StoreTransfer.findById(id);
    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found.' });
    }

    if (transfer.fromStoreId !== storeId) {
      return res.status(403).json({ success: false, message: 'You can only approve/reject transfers requested FROM your store.' });
    }

    transfer.status = status;
    if (status === 'Approved' || status === 'Rejected') {
      transfer.approvedBy = req.user._id;
    }

    await transfer.save();

    res.status(200).json({
      success: true,
      message: `Transfer ${status}`,
      transfer,
    });
  } catch (error) {
    next(error);
  }
};

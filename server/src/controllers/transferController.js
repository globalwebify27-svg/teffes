const {
  requestStoreTransfer,
  getStoreTransfer,
  getStoreTransfers: getStoreTransfersFS,
  getAllStoreTransfers,
  dispatchStoreTransferTransactional,
  receiveStoreTransferTransactional,
  rejectStoreTransfer,
  cancelStoreTransferTransactional,
  updateTransferStatus: updateTransferStatusFS,
} = require('../services/firestore/transfer.firestore.service');

// Request a transfer from another store
exports.requestTransfer = async (req, res, next) => {
  try {
    const { fromStoreId, toStoreId, items, notes } = req.body;
    const requestingStoreId = toStoreId || req.user?.storeId;

    if (!requestingStoreId && req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'You are not assigned to a store.' });
    }

    if (!fromStoreId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Source store (fromStoreId) and items are required.' });
    }

    const transfer = await requestStoreTransfer({
      fromStoreId: String(fromStoreId).trim(),
      toStoreId: String(requestingStoreId).trim(),
      items,
      user: req.user,
      notes: notes || '',
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

// Get transfers for store (or all transfers for superadmin)
exports.getStoreTransfers = async (req, res, next) => {
  try {
    const storeId = req.query?.storeId || req.user?.storeId;

    if (!storeId) {
      if (req.user?.role === 'superadmin') {
        const allTransfers = await getAllStoreTransfers();
        return res.status(200).json({
          success: true,
          transfers: allTransfers,
          inbound: allTransfers,
          outbound: [],
        });
      }
      return res.status(403).json({ success: false, message: 'You are not assigned to a store.' });
    }

    const { inbound, outbound } = await getStoreTransfersFS(String(storeId).trim());

    res.status(200).json({
      success: true,
      inbound,
      outbound,
    });
  } catch (error) {
    next(error);
  }
};

// Dispatch transfer (Pending -> In-Transit)
exports.dispatchTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const transfer = await dispatchStoreTransferTransactional({
      transferId: id,
      user: req.user,
      notes,
    });

    res.status(200).json({
      success: true,
      message: 'Transfer dispatched. Stock deducted from source store.',
      transfer,
    });
  } catch (error) {
    next(error);
  }
};

// Receive transfer (In-Transit -> Completed)
exports.receiveTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const transfer = await receiveStoreTransferTransactional({
      transferId: id,
      user: req.user,
      notes,
    });

    res.status(200).json({
      success: true,
      message: 'Transfer received and accepted. Stock credited to destination store.',
      transfer,
    });
  } catch (error) {
    next(error);
  }
};

// Reject transfer (Pending -> Rejected)
exports.rejectTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const transfer = await rejectStoreTransfer({
      transferId: id,
      user: req.user,
      notes,
    });

    res.status(200).json({
      success: true,
      message: 'Transfer rejected.',
      transfer,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel transfer
exports.cancelTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const transfer = await cancelStoreTransferTransactional({
      transferId: id,
      user: req.user,
      notes,
    });

    res.status(200).json({
      success: true,
      message: 'Transfer cancelled successfully.',
      transfer,
    });
  } catch (error) {
    next(error);
  }
};

// Backward-compatible update transfer status endpoint
exports.updateTransferStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const transfer = await updateTransferStatusFS({
      transferId: id,
      user: req.user,
      status,
      notes,
    });

    res.status(200).json({
      success: true,
      message: `Transfer status updated to ${status}`,
      transfer,
    });
  } catch (error) {
    next(error);
  }
};

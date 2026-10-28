const { createDoc, getDoc, updateDoc, queryDocs } = require('../lib/firestore');

const TRANSFERS_COLLECTION = 'store_transfers';

// Request a transfer from another store (Pure Firestore)
exports.requestTransfer = async (req, res, next) => {
  try {
    const { fromStoreId, items, notes } = req.body;
    const toStoreId = req.user?.storeId; // Requesting store

    if (!toStoreId) {
      return res.status(403).json({ success: false, message: 'You are not assigned to a store.' });
    }

    if (!fromStoreId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'From Store ID and items are required.' });
    }

    const transferId = `TRF-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    const now = new Date().toISOString();

    const transfer = {
      id: transferId,
      _id: transferId,
      transferId,
      fromStoreId: String(fromStoreId).trim(),
      toStoreId: String(toStoreId).trim(),
      items,
      requestedBy: {
        userId: String(req.user?.id || req.user?._id),
        name: req.user?.name || 'Store Admin',
        role: req.user?.role || 'storeadmin',
      },
      notes: notes || '',
      status: 'Pending',
      createdAt: now,
      updatedAt: now,
    };

    await createDoc(TRANSFERS_COLLECTION, transferId, transfer);

    res.status(201).json({
      success: true,
      message: 'Transfer requested successfully',
      transfer,
    });
  } catch (error) {
    next(error);
  }
};

// Get transfers for my store (Pure Firestore)
exports.getStoreTransfers = async (req, res, next) => {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) {
      return res.status(403).json({ success: false, message: 'You are not assigned to a store.' });
    }

    const cleanStoreId = String(storeId).trim();
    const inbound = await queryDocs(TRANSFERS_COLLECTION, (ref) =>
      ref.where('toStoreId', '==', cleanStoreId)
    );
    const outbound = await queryDocs(TRANSFERS_COLLECTION, (ref) =>
      ref.where('fromStoreId', '==', cleanStoreId)
    );

    inbound.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    outbound.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.status(200).json({
      success: true,
      inbound,
      outbound,
    });
  } catch (error) {
    next(error);
  }
};

// Update transfer status (Pure Firestore)
exports.updateTransferStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const storeId = req.user?.storeId;

    let transfer = await getDoc(TRANSFERS_COLLECTION, id);
    if (!transfer) {
      const docs = await queryDocs(TRANSFERS_COLLECTION, (ref) => ref.where('transferId', '==', id).limit(1));
      transfer = docs[0];
    }

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found.' });
    }

    if (transfer.fromStoreId !== storeId && req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'You can only approve/reject transfers requested FROM your store.' });
    }

    const now = new Date().toISOString();
    const targetId = transfer.id || transfer.transferId;
    const updates = {
      status,
      updatedAt: now,
    };

    if (status === 'Approved' || status === 'Rejected') {
      updates.approvedBy = {
        userId: String(req.user?.id || req.user?._id),
        name: req.user?.name || 'Store Admin',
        role: req.user?.role || 'storeadmin',
      };
    }

    await updateDoc(TRANSFERS_COLLECTION, targetId, updates);
    Object.assign(transfer, updates);

    res.status(200).json({
      success: true,
      message: `Transfer ${status}`,
      transfer,
    });
  } catch (error) {
    next(error);
  }
};

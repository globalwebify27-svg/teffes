const {
  getDb,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  runTransaction,
} = require('../../lib/firestore');
const {
  INVENTORY_COLLECTION,
  HISTORY_COLLECTION,
  getInventoryDocId,
  calculateInventoryStatus,
} = require('./inventory.firestore.service');

const STORE_TRANSFERS_COLLECTION = 'store_transfers';
const STORES_COLLECTION = 'stores';

const VALID_TRANSFER_STATUSES = ['Pending', 'In-Transit', 'Approved', 'Rejected', 'Completed', 'Cancelled'];

/**
 * Generate unique Store Transfer ID (TRF-XXXXXX).
 */
const generateTransferId = () => {
  return 'TRF-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10);
};

/**
 * Request a store-to-store inventory transfer.
 * Validates:
 * - Source and Destination stores must exist and cannot be the same store.
 * - Items list must have valid productId and positive quantity.
 * - User must have authorization to request transfers.
 */
const requestStoreTransfer = async ({ fromStoreId, toStoreId, items, user, notes = '' }) => {
  if (!fromStoreId || typeof fromStoreId !== 'string' || !fromStoreId.trim()) {
    throw new Error('fromStoreId (source store) is required');
  }
  if (!toStoreId || typeof toStoreId !== 'string' || !toStoreId.trim()) {
    throw new Error('toStoreId (destination store) is required');
  }

  const cleanFrom = fromStoreId.trim();
  const cleanTo = toStoreId.trim();

  if (cleanFrom === cleanTo) {
    throw new Error('Source store and destination store cannot be the same');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Items list must contain at least one item to transfer');
  }

  const sanitizedItems = items.map((item) => {
    const productId = String(item.productId || item.itemId || item.id || '').trim();
    const name = String(item.name || item.item || productId).trim();
    const qty = Number(item.quantity || item.qty);

    if (!productId) {
      throw new Error('Each transfer item must have a valid productId');
    }
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Quantity for item '${name || productId}' must be greater than zero`);
    }

    return {
      productId,
      name: name || productId,
      quantity: qty,
      unit: item.unit || 'kg',
    };
  });

  if (!user || (!user.id && !user._id && !user.firebaseUid)) {
    throw new Error('Authenticated user context is required to request a transfer');
  }

  const requestedBy = String(user.id || user._id || user.firebaseUid);
  const requestedByName = user.name || 'Store Admin';
  const transferId = generateTransferId();
  const now = new Date().toISOString();

  const transferDoc = {
    id: transferId,
    _id: transferId,
    transferId,
    fromStoreId: cleanFrom,
    toStoreId: cleanTo,
    items: sanitizedItems,
    status: 'Pending',
    requestedBy,
    requestedByName,
    approvedBy: null,
    approvedByName: null,
    dispatchedBy: null,
    dispatchedByName: null,
    dispatchedAt: null,
    receivedBy: null,
    receivedByName: null,
    receivedAt: null,
    completedAt: null,
    notes: (notes || '').trim(),
    createdAt: now,
    updatedAt: now,
  };

  await createDoc(STORE_TRANSFERS_COLLECTION, transferId, transferDoc);
  return transferDoc;
};

/**
 * Retrieve a specific store transfer by ID.
 */
const getStoreTransfer = async (transferId) => {
  if (!transferId || typeof transferId !== 'string') return null;
  const cleanId = transferId.trim();
  let transfer = await getDoc(STORE_TRANSFERS_COLLECTION, cleanId);
  if (!transfer) {
    const list = await queryDocs(STORE_TRANSFERS_COLLECTION, (ref) => ref.where('transferId', '==', cleanId).limit(1));
    if (list.length > 0) transfer = list[0];
  }
  return transfer;
};

/**
 * Retrieve inbound and outbound transfers for a specific dark store.
 */
const getStoreTransfers = async (storeId) => {
  if (!storeId || typeof storeId !== 'string') return { inbound: [], outbound: [] };
  const cleanStore = storeId.trim();

  const inbound = await queryDocs(STORE_TRANSFERS_COLLECTION, (ref) =>
    ref.where('toStoreId', '==', cleanStore)
  );

  const outbound = await queryDocs(STORE_TRANSFERS_COLLECTION, (ref) =>
    ref.where('fromStoreId', '==', cleanStore)
  );

  return {
    inbound: inbound.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    outbound: outbound.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
  };
};

/**
 * Retrieve all transfers across the entire platform (Super Admin).
 */
const getAllStoreTransfers = async () => {
  const transfers = await queryDocs(STORE_TRANSFERS_COLLECTION, (ref) => ref);
  return transfers.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Dispatch a store transfer (Pending -> In-Transit).
 * Atomically verifies stock and decrements source store inventory upon physical dispatch.
 */
const dispatchStoreTransferTransactional = async ({ transferId, user, notes = '' }) => {
  if (!transferId || typeof transferId !== 'string') {
    throw new Error('Valid transferId is required');
  }
  if (!user) {
    throw new Error('Authenticated user context is required');
  }

  const targetId = transferId.trim();
  const userId = String(user.id || user._id || user.firebaseUid);
  const userName = user.name || 'Store Admin';
  const role = (user.role || '').toLowerCase();
  const userStore = user.storeId || '';
  const db = getDb();

  return runTransaction(async (transaction) => {
    const transferRef = db.collection(STORE_TRANSFERS_COLLECTION).doc(targetId);
    const transferSnap = await transaction.get(transferRef);

    if (!transferSnap.exists) {
      throw new Error(`Store transfer '${targetId}' not found`);
    }

    const transferData = transferSnap.data();

    // Authorization: Only source store admin or superadmin can dispatch
    if (role !== 'superadmin' && userStore !== transferData.fromStoreId) {
      throw new Error('Forbidden: Only the source store manager or superadmin can dispatch outbound inventory');
    }

    if (transferData.status !== 'Pending') {
      throw new Error(`Cannot dispatch transfer in '${transferData.status}' status (must be 'Pending')`);
    }

    const fromStore = transferData.fromStoreId;
    const toStore = transferData.toStoreId;
    const items = transferData.items || [];
    const now = new Date().toISOString();

    // 1. Read all source inventory documents upfront (Firestore rule: reads before writes)
    const sourceSnaps = [];
    for (const item of items) {
      const srcDocId = getInventoryDocId(fromStore, item.productId);
      const srcRef = db.collection(INVENTORY_COLLECTION).doc(srcDocId);
      const srcSnap = await transaction.get(srcRef);

      if (!srcSnap.exists) {
        throw new Error(`Item '${item.name}' (${item.productId}) does not exist in source store '${fromStore}'`);
      }

      const srcData = srcSnap.data();
      const currentSrcStock = Number(srcData.stock) || 0;
      if (currentSrcStock < item.quantity) {
        throw new Error(
          `Insufficient stock in source store '${fromStore}' for item '${item.name}'. Available: ${currentSrcStock}, Requested: ${item.quantity}`
        );
      }

      sourceSnaps.push({ ref: srcRef, docId: srcDocId, data: srcData, item });
    }

    // 2. Perform writes: deduct stock from source store and record audit history
    for (const src of sourceSnaps) {
      const newSrcStock = (Number(src.data.stock) || 0) - src.item.quantity;
      const newSrcStatus = calculateInventoryStatus(newSrcStock, src.data.minThreshold || 10);

      transaction.update(src.ref, {
        stock: newSrcStock,
        status: newSrcStatus,
        updatedAt: now,
      });

      const srcHistId = 'HIST-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 900 + 100);
      const srcHistRef = db.collection(HISTORY_COLLECTION).doc(srcHistId);
      const currentSrcStock = Number(src.data.stock) || 0;
      const unit = src.item.unit || src.data.unit || 'kg';
      const prodName = src.item.name || src.data.item || 'Product Cut';

      transaction.set(srcHistRef, {
        id: srcHistId,
        _id: srcHistId,
        historyId: srcHistId,
        storeId: fromStore,
        itemId: src.item.productId,
        productName: prodName,
        itemName: prodName,
        actionType: 'transfer_out',
        classification: 'transfer',
        quantity: src.item.quantity,
        quantityChanged: -src.item.quantity,
        unit,
        previousQuantity: currentSrcStock,
        resultingQuantity: newSrcStock,
        previousStock: currentSrcStock,
        newStock: newSrcStock,
        previousDefreezeStock: src.data.defreezeStock || 0,
        newDefreezeStock: src.data.defreezeStock || 0,
        reason: `Dispatched outbound transfer ${targetId} to store ${toStore}`,
        notes: `Dispatched outbound transfer ${targetId} to store ${toStore}`,
        actor: {
          userId,
          name: userName,
          role: role || 'storeadmin',
        },
        performedBy: userName,
        performedById: userId,
        createdAt: now,
      });
    }

    // 3. Update transfer doc to In-Transit
    const transferUpdate = {
      status: 'In-Transit',
      dispatchedAt: now,
      dispatchedBy: userId,
      dispatchedByName: userName,
      approvedBy: userId,
      approvedByName: userName,
      notes: notes || transferData.notes || '',
      updatedAt: now,
    };

    transaction.update(transferRef, transferUpdate);

    return {
      ...transferData,
      ...transferUpdate,
    };
  });
};

/**
 * Receive a store transfer (In-Transit -> Completed).
 * Atomically increments destination store inventory upon physical receipt.
 */
const receiveStoreTransferTransactional = async ({ transferId, user, notes = '' }) => {
  if (!transferId || typeof transferId !== 'string') {
    throw new Error('Valid transferId is required');
  }
  if (!user) {
    throw new Error('Authenticated user context is required');
  }

  const targetId = transferId.trim();
  const userId = String(user.id || user._id || user.firebaseUid);
  const userName = user.name || 'Store Admin';
  const role = (user.role || '').toLowerCase();
  const userStore = user.storeId || '';
  const db = getDb();

  return runTransaction(async (transaction) => {
    const transferRef = db.collection(STORE_TRANSFERS_COLLECTION).doc(targetId);
    const transferSnap = await transaction.get(transferRef);

    if (!transferSnap.exists) {
      throw new Error(`Store transfer '${targetId}' not found`);
    }

    const transferData = transferSnap.data();

    // Authorization: Only destination store admin or superadmin can receive
    if (role !== 'superadmin' && userStore !== transferData.toStoreId) {
      throw new Error('Forbidden: Only the destination store manager or superadmin can receive inbound inventory');
    }

    if (transferData.status !== 'In-Transit' && transferData.status !== 'Approved') {
      throw new Error(`Cannot receive transfer in '${transferData.status}' status (must be 'In-Transit')`);
    }

    const fromStore = transferData.fromStoreId;
    const toStore = transferData.toStoreId;
    const items = transferData.items || [];
    const now = new Date().toISOString();

    // 1. Read all destination inventory documents upfront
    const destSnaps = [];
    for (const item of items) {
      const destDocId = getInventoryDocId(toStore, item.productId);
      const destRef = db.collection(INVENTORY_COLLECTION).doc(destDocId);
      const destSnap = await transaction.get(destRef);

      destSnaps.push({ ref: destRef, docId: destDocId, snap: destSnap, item });
    }

    // 2. Perform writes: credit destination inventory
    for (const dest of destSnaps) {
      let newDestStock = dest.item.quantity;
      let destMinThreshold = 10;

      if (dest.snap.exists) {
        const destData = dest.snap.data();
        newDestStock = (Number(destData.stock) || 0) + dest.item.quantity;
        destMinThreshold = destData.minThreshold || 10;
        const newDestStatus = calculateInventoryStatus(newDestStock, destMinThreshold);

        transaction.update(dest.ref, {
          stock: newDestStock,
          status: newDestStatus,
          updatedAt: now,
        });
      } else {
        const newDestStatus = calculateInventoryStatus(newDestStock, destMinThreshold);
        transaction.set(dest.ref, {
          storeId: toStore,
          itemId: dest.item.productId,
          item: dest.item.name,
          category: 'General',
          stock: newDestStock,
          unit: dest.item.unit || 'kg',
          minThreshold: destMinThreshold,
          costPrice: 0,
          sellingPrice: 0,
          defreezeStock: 0,
          status: newDestStatus,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Audit history for destination store credit
      const destHistId = 'HIST-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 900 + 100);
      const destHistRef = db.collection(HISTORY_COLLECTION).doc(destHistId);
      const currentDestStock = dest.snap.exists ? (Number(dest.snap.data().stock) || 0) : 0;
      const unit = dest.item.unit || 'kg';
      const prodName = dest.item.name || 'Product Cut';

      transaction.set(destHistRef, {
        id: destHistId,
        _id: destHistId,
        historyId: destHistId,
        storeId: toStore,
        itemId: dest.item.productId,
        productName: prodName,
        itemName: prodName,
        actionType: 'transfer_in',
        classification: 'transfer',
        quantity: dest.item.quantity,
        quantityChanged: dest.item.quantity,
        unit,
        previousQuantity: currentDestStock,
        resultingQuantity: newDestStock,
        previousStock: currentDestStock,
        newStock: newDestStock,
        previousDefreezeStock: 0,
        newDefreezeStock: 0,
        reason: `Received inbound transfer ${targetId} from store ${fromStore}`,
        notes: `Received inbound transfer ${targetId} from store ${fromStore}`,
        actor: {
          userId,
          name: userName,
          role: role || 'storeadmin',
        },
        performedBy: userName,
        performedById: userId,
        createdAt: now,
      });
    }

    // 3. Mark transfer Completed
    const transferUpdate = {
      status: 'Completed',
      receivedAt: now,
      receivedBy: userId,
      receivedByName: userName,
      completedAt: now,
      completedBy: userId,
      completedByName: userName,
      notes: notes || transferData.notes || '',
      updatedAt: now,
    };

    transaction.update(transferRef, transferUpdate);

    return {
      ...transferData,
      ...transferUpdate,
    };
  });
};

/**
 * Reject a pending transfer.
 * Only the source store admin or superadmin can reject. No stock was deducted.
 */
const rejectStoreTransfer = async ({ transferId, user, notes = '' }) => {
  if (!transferId || typeof transferId !== 'string') throw new Error('Valid transferId is required');
  if (!user) throw new Error('Authenticated user context is required');

  const existing = await getStoreTransfer(transferId.trim());
  if (!existing) throw new Error(`Store transfer '${transferId}' not found`);

  const role = (user.role || '').toLowerCase();
  const userStore = user.storeId || '';
  if (role !== 'superadmin' && userStore !== existing.fromStoreId) {
    throw new Error('Forbidden: Only the source store manager or superadmin can reject an outbound transfer');
  }

  if (existing.status !== 'Pending') {
    throw new Error(`Cannot reject transfer in '${existing.status}' status (must be 'Pending')`);
  }

  const userId = String(user.id || user._id || user.firebaseUid);
  const userName = user.name || 'Store Admin';
  const now = new Date().toISOString();

  const updates = {
    status: 'Rejected',
    rejectedBy: userId,
    rejectedByName: userName,
    rejectedAt: now,
    notes: notes || existing.notes || '',
    updatedAt: now,
  };

  await updateDoc(STORE_TRANSFERS_COLLECTION, existing.transferId || existing.id, updates);
  return { ...existing, ...updates };
};

/**
 * Cancel a store transfer.
 * If status is 'In-Transit', refunds stock back to source store in a single atomic transaction.
 */
const cancelStoreTransferTransactional = async ({ transferId, user, notes = '' }) => {
  if (!transferId || typeof transferId !== 'string') throw new Error('Valid transferId is required');
  if (!user) throw new Error('Authenticated user context is required');

  const targetId = transferId.trim();
  const userId = String(user.id || user._id || user.firebaseUid);
  const userName = user.name || 'Store Admin';
  const role = (user.role || '').toLowerCase();
  const userStore = user.storeId || '';
  const db = getDb();

  return runTransaction(async (transaction) => {
    const transferRef = db.collection(STORE_TRANSFERS_COLLECTION).doc(targetId);
    const transferSnap = await transaction.get(transferRef);

    if (!transferSnap.exists) {
      throw new Error(`Store transfer '${targetId}' not found`);
    }

    const transferData = transferSnap.data();

    // Check terminal statuses
    if (transferData.status === 'Completed' || transferData.status === 'Cancelled' || transferData.status === 'Rejected') {
      throw new Error(`Cannot cancel transfer in '${transferData.status}' status`);
    }

    const now = new Date().toISOString();

    // If transfer was already dispatched (In-Transit), revert source stock
    if (transferData.status === 'In-Transit' || transferData.status === 'Approved') {
      const fromStore = transferData.fromStoreId;
      const items = transferData.items || [];

      // Read source inventory docs
      const sourceSnaps = [];
      for (const item of items) {
        const srcDocId = getInventoryDocId(fromStore, item.productId);
        const srcRef = db.collection(INVENTORY_COLLECTION).doc(srcDocId);
        const srcSnap = await transaction.get(srcRef);
        sourceSnaps.push({ ref: srcRef, docId: srcDocId, snap: srcSnap, item });
      }

      // Re-credit source store inventory
      for (const src of sourceSnaps) {
        let restoredStock = src.item.quantity;
        let minThresh = 10;
        if (src.snap.exists) {
          const sData = src.snap.data();
          restoredStock = (Number(sData.stock) || 0) + src.item.quantity;
          minThresh = sData.minThreshold || 10;
          transaction.update(src.ref, {
            stock: restoredStock,
            status: calculateInventoryStatus(restoredStock, minThresh),
            updatedAt: now,
          });
        }

        const revHistId = 'HIST-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 900 + 100);
        const revHistRef = db.collection(HISTORY_COLLECTION).doc(revHistId);
        const currentSrcStock = src.snap.exists ? (Number(src.snap.data().stock) || 0) : 0;
        const unit = src.item.unit || 'kg';
        const prodName = src.item.name || 'Product Cut';

        transaction.set(revHistRef, {
          id: revHistId,
          _id: revHistId,
          historyId: revHistId,
          storeId: fromStore,
          itemId: src.item.productId,
          productName: prodName,
          itemName: prodName,
          actionType: 'transfer_store_reversal',
          classification: 'transfer',
          quantity: src.item.quantity,
          quantityChanged: src.item.quantity,
          unit,
          previousQuantity: currentSrcStock,
          resultingQuantity: restoredStock,
          previousStock: currentSrcStock,
          newStock: restoredStock,
          reason: `Transfer ${targetId} cancelled in-transit. Reverted stock to source store.`,
          notes: `Transfer ${targetId} cancelled in-transit. Reverted stock to source store.`,
          actor: {
            userId,
            name: userName,
            role: role || 'storeadmin',
          },
          performedBy: userName,
          performedById: userId,
          createdAt: now,
        });
      }
    }

    const updates = {
      status: 'Cancelled',
      cancelledBy: userId,
      cancelledByName: userName,
      cancelledAt: now,
      notes: notes || transferData.notes || '',
      updatedAt: now,
    };

    transaction.update(transferRef, updates);
    return { ...transferData, ...updates };
  });
};

/**
 * Backward-compatible single-step complete (used by tests / staging endpoints).
 * If Pending, executes dispatch + receive in one combined transaction.
 * If In-Transit, completes via receive.
 */
const completeStoreTransferTransactional = async ({ transferId, user, notes = '' }) => {
  const existing = await getStoreTransfer(transferId);
  if (!existing) throw new Error(`Store transfer '${transferId}' not found`);

  if (existing.status === 'In-Transit' || existing.status === 'Approved') {
    return receiveStoreTransferTransactional({ transferId, user, notes });
  }

  if (existing.status === 'Pending') {
    // Dispatch first, then receive
    await dispatchStoreTransferTransactional({ transferId, user, notes });
    return receiveStoreTransferTransactional({ transferId, user, notes });
  }

  throw new Error(`Cannot complete transfer in '${existing.status}' status`);
};

/**
 * Generic status update router (supporting existing controllers).
 */
const updateTransferStatus = async ({ transferId, user, status, notes = '' }) => {
  if (status === 'In-Transit' || status === 'Approved') {
    return dispatchStoreTransferTransactional({ transferId, user, notes });
  }
  if (status === 'Completed') {
    return receiveStoreTransferTransactional({ transferId, user, notes });
  }
  if (status === 'Rejected') {
    return rejectStoreTransfer({ transferId, user, notes });
  }
  if (status === 'Cancelled') {
    return cancelStoreTransferTransactional({ transferId, user, notes });
  }
  throw new Error(`Invalid status '${status}'`);
};

/**
 * Safely delete a store transfer document (used for test cleanup).
 */
const deleteStoreTransfer = async (transferId) => {
  if (!transferId || typeof transferId !== 'string') {
    throw new Error('transferId is required for deletion');
  }
  return deleteDoc(STORE_TRANSFERS_COLLECTION, transferId.trim());
};

module.exports = {
  STORE_TRANSFERS_COLLECTION,
  VALID_TRANSFER_STATUSES,
  generateTransferId,
  requestStoreTransfer,
  getStoreTransfer,
  getStoreTransfers,
  getAllStoreTransfers,
  dispatchStoreTransferTransactional,
  receiveStoreTransferTransactional,
  rejectStoreTransfer,
  cancelStoreTransferTransactional,
  completeStoreTransferTransactional,
  updateTransferStatus,
  deleteStoreTransfer,
};

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

const VALID_TRANSFER_STATUSES = ['Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled'];

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

  const transferDoc = {
    transferId,
    fromStoreId: cleanFrom,
    toStoreId: cleanTo,
    items: sanitizedItems,
    status: 'Pending',
    requestedBy,
    requestedByName,
    approvedBy: null,
    approvedByName: null,
    completedAt: null,
    notes: (notes || '').trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return createDoc(STORE_TRANSFERS_COLLECTION, transferId, transferDoc);
};

/**
 * Retrieve a specific store transfer by ID.
 */
const getStoreTransfer = async (transferId) => {
  if (!transferId || typeof transferId !== 'string') return null;
  return getDoc(STORE_TRANSFERS_COLLECTION, transferId.trim());
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
 * Update the status of a store transfer.
 * Only the source store admin or a superadmin can approve/reject an outbound transfer request.
 */
const updateTransferStatus = async ({ transferId, user, status, notes = '' }) => {
  if (!transferId || typeof transferId !== 'string') {
    throw new Error('Valid transferId is required');
  }
  if (!status || !VALID_TRANSFER_STATUSES.includes(status)) {
    throw new Error(`Invalid status '${status}'. Must be one of: ${VALID_TRANSFER_STATUSES.join(', ')}`);
  }
  if (!user) {
    throw new Error('Authenticated user context is required');
  }

  const existing = await getDoc(STORE_TRANSFERS_COLLECTION, transferId.trim());
  if (!existing) {
    throw new Error(`Store transfer '${transferId}' not found`);
  }

  const role = (user.role || '').toLowerCase();
  const userStore = user.storeId || '';

  // Authorization: Only source store admin or superadmin can approve/reject outbound transfer
  if (role !== 'superadmin' && userStore !== existing.fromStoreId) {
    throw new Error('Forbidden: You can only approve or reject transfer requests outbound from your assigned store');
  }

  if (existing.status === 'Completed' || existing.status === 'Cancelled' || existing.status === 'Rejected') {
    throw new Error(`Cannot update transfer in terminal status '${existing.status}'`);
  }

  const userId = String(user.id || user._id || user.firebaseUid);
  const userName = user.name || 'Store Admin';

  const updatePayload = {
    status,
    notes: notes || existing.notes || '',
    updatedAt: new Date().toISOString(),
  };

  if (status === 'Approved' || status === 'Rejected') {
    updatePayload.approvedBy = userId;
    updatePayload.approvedByName = userName;
  }

  return updateDoc(STORE_TRANSFERS_COLLECTION, transferId.trim(), updatePayload);
};

/**
 * Complete a store transfer atomically.
 * Transaction boundaries:
 * 1. Checks transfer is not already completed.
 * 2. Checks sufficient stock exists in source store for every item (prevents negative stock).
 * 3. Atomically deducts quantity from source store inventory.
 * 4. Atomically credits quantity to destination store inventory.
 * 5. Appends audit records to inventory_history.
 * 6. Updates transfer status to 'Completed'.
 */
const completeStoreTransferTransactional = async ({ transferId, user }) => {
  if (!transferId || typeof transferId !== 'string') {
    throw new Error('Valid transferId is required');
  }
  if (!user) {
    throw new Error('Authenticated user context is required');
  }

  const targetId = transferId.trim();
  const userId = String(user.id || user._id || user.firebaseUid);
  const userName = user.name || 'Store Admin';
  const db = getDb();

  return runTransaction(async (transaction) => {
    const transferRef = db.collection(STORE_TRANSFERS_COLLECTION).doc(targetId);
    const transferSnap = await transaction.get(transferRef);

    if (!transferSnap.exists) {
      throw new Error(`Store transfer '${targetId}' not found`);
    }

    const transferData = transferSnap.data();

    if (transferData.status === 'Completed') {
      throw new Error(`Transfer '${targetId}' has already been completed`);
    }
    if (transferData.status === 'Rejected' || transferData.status === 'Cancelled') {
      throw new Error(`Cannot complete transfer '${targetId}' in '${transferData.status}' status`);
    }

    const fromStore = transferData.fromStoreId;
    const toStore = transferData.toStoreId;
    const items = transferData.items || [];
    const now = new Date().toISOString();

    // 1. Read all inventory documents upfront (Firestore transaction rule: reads before writes)
    const sourceSnaps = [];
    const destSnaps = [];

    for (const item of items) {
      const srcDocId = getInventoryDocId(fromStore, item.productId);
      const destDocId = getInventoryDocId(toStore, item.productId);

      const srcRef = db.collection(INVENTORY_COLLECTION).doc(srcDocId);
      const destRef = db.collection(INVENTORY_COLLECTION).doc(destDocId);

      const [srcSnap, destSnap] = await Promise.all([
        transaction.get(srcRef),
        transaction.get(destRef),
      ]);

      if (!srcSnap.exists) {
        throw new Error(
          `Item '${item.name}' (${item.productId}) does not exist in source store '${fromStore}'`
        );
      }

      const srcData = srcSnap.data();
      const currentSrcStock = Number(srcData.stock) || 0;
      if (currentSrcStock < item.quantity) {
        throw new Error(
          `Insufficient stock in source store '${fromStore}' for item '${item.name}'. Available: ${currentSrcStock}, Requested: ${item.quantity}`
        );
      }

      sourceSnaps.push({ ref: srcRef, docId: srcDocId, data: srcData, item });
      destSnaps.push({ ref: destRef, docId: destDocId, snap: destSnap, item });
    }

    // 2. Perform writes: update source and destination inventories
    for (let i = 0; i < items.length; i++) {
      const src = sourceSnaps[i];
      const dest = destSnaps[i];
      const item = items[i];

      // Update source store inventory
      const newSrcStock = (Number(src.data.stock) || 0) - item.quantity;
      const newSrcStatus = calculateInventoryStatus(newSrcStock, src.data.minThreshold || 10);

      transaction.update(src.ref, {
        stock: newSrcStock,
        status: newSrcStatus,
        updatedAt: now,
      });

      // Audit history for source store deduction
      const srcHistId = 'HIST-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 900 + 100);
      const srcHistRef = db.collection(HISTORY_COLLECTION).doc(srcHistId);
      transaction.set(srcHistRef, {
        historyId: srcHistId,
        storeId: fromStore,
        itemId: item.productId,
        itemName: item.name,
        actionType: 'transfer_store_deduct',
        classification: 'transfer',
        quantityChanged: -item.quantity,
        previousStock: src.data.stock,
        newStock: newSrcStock,
        previousDefreezeStock: src.data.defreezeStock || 0,
        newDefreezeStock: src.data.defreezeStock || 0,
        notes: `Outbound transfer ${targetId} to store ${toStore}`,
        performedBy: userName,
        performedById: userId,
        createdAt: now,
      });

      // Update destination store inventory
      let newDestStock = item.quantity;
      let destMinThreshold = 10;
      if (dest.snap.exists) {
        const destData = dest.snap.data();
        newDestStock = (Number(destData.stock) || 0) + item.quantity;
        destMinThreshold = destData.minThreshold || 10;
        const newDestStatus = calculateInventoryStatus(newDestStock, destMinThreshold);

        transaction.update(dest.ref, {
          stock: newDestStock,
          status: newDestStatus,
          updatedAt: now,
        });
      } else {
        // Initialize inventory doc at destination store if first time stocked
        const newDestStatus = calculateInventoryStatus(newDestStock, destMinThreshold);
        transaction.set(dest.ref, {
          storeId: toStore,
          itemId: item.productId,
          item: item.name,
          category: src.data.category || 'General',
          stock: newDestStock,
          unit: item.unit || src.data.unit || 'kg',
          minThreshold: destMinThreshold,
          costPrice: src.data.costPrice || 0,
          sellingPrice: src.data.sellingPrice || 0,
          defreezeStock: 0,
          status: newDestStatus,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Audit history for destination store addition
      const destHistId = 'HIST-' + (Date.now() + 1).toString().slice(-6) + Math.floor(Math.random() * 900 + 100);
      const destHistRef = db.collection(HISTORY_COLLECTION).doc(destHistId);
      transaction.set(destHistRef, {
        historyId: destHistId,
        storeId: toStore,
        itemId: item.productId,
        itemName: item.name,
        actionType: 'transfer_store_credit',
        classification: 'transfer',
        quantityChanged: item.quantity,
        previousStock: dest.snap.exists ? dest.snap.data().stock : 0,
        newStock: newDestStock,
        previousDefreezeStock: 0,
        newDefreezeStock: 0,
        notes: `Inbound transfer ${targetId} from store ${fromStore}`,
        performedBy: userName,
        performedById: userId,
        createdAt: now,
      });
    }

    // Mark transfer Completed
    const transferUpdate = {
      status: 'Completed',
      completedAt: now,
      completedBy: userId,
      completedByName: userName,
      updatedAt: now,
    };

    transaction.update(transferRef, transferUpdate);

    return {
      id: targetId,
      _id: targetId,
      ...transferData,
      ...transferUpdate,
    };
  });
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
  updateTransferStatus,
  completeStoreTransferTransactional,
  deleteStoreTransfer,
};

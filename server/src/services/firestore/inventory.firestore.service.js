const {
  getDb,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  runTransaction,
} = require('../../lib/firestore');

const INVENTORY_COLLECTION = 'inventory';
const HISTORY_COLLECTION = 'inventory_history';

/**
 * Generate a deterministic document ID for store-specific inventory.
 * Guarantees O(1) direct access and strictly prevents duplicate store-product records.
 */
const getInventoryDocId = (storeId, itemId) => {
  if (!storeId || !itemId) {
    throw new Error('Both storeId and itemId are required to generate inventory ID');
  }
  return `${storeId.trim()}_${itemId.trim()}`;
};

/**
 * Determine inventory status based on stock and min threshold.
 */
const calculateInventoryStatus = (stock, minThreshold = 10) => {
  const s = Number(stock) || 0;
  const m = Number(minThreshold) || 10;
  if (s <= 0) return 'Out of Stock';
  if (s <= m) return 'Low Stock';
  return 'In Stock';
};

/**
 * Retrieve inventory items for a specific store.
 */
const getStoreInventory = async (storeId) => {
  if (!storeId || typeof storeId !== 'string') return [];
  const items = await queryDocs(INVENTORY_COLLECTION, (ref) =>
    ref.where('storeId', '==', storeId.trim())
  );
  return items.sort((a, b) => (a.item || '').localeCompare(b.item || ''));
};

/**
 * Retrieve a single inventory item by storeId and itemId.
 */
const getInventoryItem = async (storeId, itemId) => {
  const docId = getInventoryDocId(storeId, itemId);
  return getDoc(INVENTORY_COLLECTION, docId);
};

/**
 * Safely create a new inventory record.
 * Rejects duplicate storeId + itemId combinations.
 */
const createInventoryItem = async (data = {}) => {
  if (!data.storeId || typeof data.storeId !== 'string' || !data.storeId.trim()) {
    throw new Error('storeId is required');
  }
  if (!data.itemId || typeof data.itemId !== 'string' || !data.itemId.trim()) {
    throw new Error('itemId is required');
  }
  if (!data.item || typeof data.item !== 'string' || !data.item.trim()) {
    throw new Error('Item name is required');
  }

  const storeId = data.storeId.trim();
  const itemId = data.itemId.trim();
  const docId = getInventoryDocId(storeId, itemId);

  const existing = await getDoc(INVENTORY_COLLECTION, docId);
  if (existing) {
    throw new Error(`Inventory record for item "${itemId}" in store "${storeId}" already exists`);
  }

  const stock = Math.max(0, Number(data.stock) || 0);
  const min = Math.max(0, Number(data.min) || 10);
  const status = calculateInventoryStatus(stock, min);

  const payload = {
    id: docId,
    storeId,
    itemId,
    item: data.item.trim(),
    category: (data.category || 'fresh').trim(),
    stock,
    defreezeStock: Math.max(0, Number(data.defreezeStock) || 0),
    wasteStock: Math.max(0, Number(data.wasteStock) || 0),
    min,
    unit: (data.unit || 'kg').trim(),
    status,
    lastRestocked: data.lastRestocked || `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
  };

  return createDoc(INVENTORY_COLLECTION, docId, payload, { overwrite: false });
};

/**
 * Atomically validate and deduct stock for an order using a Firestore transaction.
 *
 * Concurrency & Atomicity Guarantees:
 * - Runs with strict serializable isolation inside db.runTransaction().
 * - All items are verified before any deduction occurs.
 * - If ANY item has insufficient stock, the transaction throws and aborts completely.
 * - Negative stock is mathematically impossible.
 * - Audit entries are created in inventory_history.
 */
const deductStockTransactional = async ({ storeId, items, orderId = null, actor = null }) => {
  if (!storeId || !Array.isArray(items) || items.length === 0) {
    return { success: true, deductedItems: [] };
  }

  const db = getDb();

  return runTransaction(async (transaction) => {
    // 1. Read all requested items in the transaction
    const reads = [];
    for (const item of items) {
      const docId = getInventoryDocId(storeId, item.productId || item.itemId || item.id);
      const docRef = db.collection(INVENTORY_COLLECTION).doc(docId);
      reads.push({ item, docRef });
    }

    const itemSnapshots = [];
    for (const r of reads) {
      const snap = await transaction.get(r.docRef);
      if (!snap.exists) {
        throw new Error(`Item "${r.item.name || r.item.id}" is not available in store ${storeId} inventory`);
      }
      itemSnapshots.push({ ...r, data: snap.data(), snap });
    }

    // 2. Validate stock sufficiency for all items
    for (const entry of itemSnapshots) {
      const requestedQty = Math.max(1, Number(entry.item.quantity) || 1);
      const currentStock = Number(entry.data.stock) || 0;

      if (currentStock < requestedQty) {
        throw new Error(
          `Insufficient stock for "${entry.data.item}". Requested: ${requestedQty} ${entry.data.unit}, Available: ${currentStock} ${entry.data.unit}`
        );
      }
    }

    // 3. Apply atomic deductions and log history
    const successfulDeductions = [];
    const now = new Date().toISOString();

    for (const entry of itemSnapshots) {
      const requestedQty = Math.max(1, Number(entry.item.quantity) || 1);
      const currentStock = Number(entry.data.stock) || 0;
      const newStock = Math.round((currentStock - requestedQty) * 1000) / 1000;
      const newStatus = calculateInventoryStatus(newStock, entry.data.min);

      // Mutate inventory doc
      transaction.update(entry.docRef, {
        stock: newStock,
        status: newStatus,
        updatedAt: now,
      });

      // Append immutable audit log to inventory_history
      const historyRef = db.collection(HISTORY_COLLECTION).doc();
      transaction.set(historyRef, {
        id: historyRef.id,
        _id: historyRef.id,
        storeId,
        itemId: entry.data.itemId,
        productName: entry.data.item,
        category: entry.data.category || '',
        classification: 'fresh',
        actionType: 'order_deduction',
        quantity: requestedQty,
        unit: entry.data.unit || 'kg',
        previousQuantity: currentStock,
        resultingQuantity: newStock,
        sourceClassification: 'fresh',
        destinationClassification: null,
        reason: orderId ? `Order #${orderId}` : 'Customer order deduction',
        orderId: orderId || null,
        actor: actor ? {
          userId: actor.userId || null,
          name: actor.name || 'Customer / Order System',
          role: actor.role || 'customer',
          email: actor.email || '',
        } : { name: 'Customer / Order System', role: 'customer' },
        createdAt: now,
      });

      successfulDeductions.push({
        itemId: entry.data.itemId,
        item: entry.data.item,
        deductedAmount: requestedQty,
        remainingStock: newStock,
        status: newStatus,
      });
    }

    return {
      success: true,
      deductedItems: successfulDeductions,
    };
  });
};

/**
 * Transfer stock from De-Freeze to Fresh inventory atomically.
 */
const transferDefreezeToFreshTransactional = async ({ storeId, itemId, quantity, user = null, notes = '' }) => {
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Transfer quantity must be a positive number');
  }

  const db = getDb();
  const docId = getInventoryDocId(storeId, itemId);
  const docRef = db.collection(INVENTORY_COLLECTION).doc(docId);

  return runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists) {
      throw new Error(`Inventory item "${itemId}" not found for store "${storeId}"`);
    }

    const data = snap.data();
    const currentDefreeze = Number(data.defreezeStock) || 0;
    if (currentDefreeze < qty) {
      throw new Error(
        `Insufficient De-Freeze stock. Available: ${currentDefreeze} ${data.unit}, Requested: ${qty} ${data.unit}`
      );
    }

    const currentFresh = Number(data.stock) || 0;
    const newDefreeze = Math.round((currentDefreeze - qty) * 1000) / 1000;
    const newFresh = Math.round((currentFresh + qty) * 1000) / 1000;
    const newStatus = calculateInventoryStatus(newFresh, data.min);
    const now = new Date().toISOString();

    transaction.update(docRef, {
      defreezeStock: newDefreeze,
      stock: newFresh,
      status: newStatus,
      lastRestocked: `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      updatedAt: now,
    });

    // History record
    const historyRef = db.collection(HISTORY_COLLECTION).doc();
    transaction.set(historyRef, {
      id: historyRef.id,
      _id: historyRef.id,
      storeId,
      itemId,
      productName: data.item,
      category: data.category || '',
      classification: 'transfer',
      actionType: 'transfer_defreeze_to_fresh',
      quantity: qty,
      unit: data.unit || 'kg',
      previousQuantity: currentDefreeze,
      resultingQuantity: newDefreeze,
      sourceClassification: 'defreeze',
      destinationClassification: 'fresh',
      reason: notes || `Moved ${qty} ${data.unit} from De-Freeze to Fresh`,
      actor: user ? {
        userId: user.id || null,
        name: user.name || 'Store Admin',
        role: user.role || 'storeadmin',
        email: user.email || '',
      } : { name: 'Store Admin', role: 'storeadmin' },
      createdAt: now,
    });

    return {
      success: true,
      stock: newFresh,
      defreezeStock: newDefreeze,
      status: newStatus,
    };
  });
};

/**
 * Record damage/waste stock from Fresh or De-Freeze inventory atomically.
 */
const recordDamageWasteTransactional = async ({
  storeId,
  itemId,
  sourceClassification = 'fresh',
  quantity,
  reason = 'Damaged',
  notes = '',
  user = null,
}) => {
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Waste quantity must be a positive number');
  }

  const src = ['fresh', 'defreeze'].includes(sourceClassification) ? sourceClassification : 'fresh';
  const db = getDb();
  const docId = getInventoryDocId(storeId, itemId);
  const docRef = db.collection(INVENTORY_COLLECTION).doc(docId);

  return runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists) {
      throw new Error(`Inventory item "${itemId}" not found for store "${storeId}"`);
    }

    const data = snap.data();
    const currentSrcStock = src === 'fresh' ? Number(data.stock) || 0 : Number(data.defreezeStock) || 0;

    if (currentSrcStock < qty) {
      throw new Error(
        `Insufficient ${src === 'fresh' ? 'Fresh' : 'De-Freeze'} stock. Available: ${currentSrcStock} ${data.unit}, Requested: ${qty} ${data.unit}`
      );
    }

    const newSrcStock = Math.round((currentSrcStock - qty) * 1000) / 1000;
    const currentWaste = Number(data.wasteStock) || 0;
    const newWaste = Math.round((currentWaste + qty) * 1000) / 1000;
    const now = new Date().toISOString();

    const updatePayload = {
      wasteStock: newWaste,
      updatedAt: now,
    };

    if (src === 'fresh') {
      updatePayload.stock = newSrcStock;
      updatePayload.status = calculateInventoryStatus(newSrcStock, data.min);
    } else {
      updatePayload.defreezeStock = newSrcStock;
    }

    transaction.update(docRef, updatePayload);

    // History record
    const historyRef = db.collection(HISTORY_COLLECTION).doc();
    transaction.set(historyRef, {
      id: historyRef.id,
      _id: historyRef.id,
      storeId,
      itemId,
      productName: data.item,
      category: data.category || '',
      classification: 'waste',
      actionType: 'record_waste',
      quantity: qty,
      unit: data.unit || 'kg',
      previousQuantity: currentSrcStock,
      resultingQuantity: newSrcStock,
      sourceClassification: src,
      destinationClassification: 'waste',
      reason,
      notes,
      actor: user ? {
        userId: user.id || null,
        name: user.name || 'Store Admin',
        role: user.role || 'storeadmin',
        email: user.email || '',
      } : { name: 'Store Admin', role: 'storeadmin' },
      createdAt: now,
    });

    return {
      success: true,
      wasteStock: newWaste,
      remainingSourceStock: newSrcStock,
      source: src,
    };
  });
};

/**
/**
 * Safely update an inventory record.
 */
const updateInventoryItem = async (storeId, itemId, updates = {}) => {
  const docId = getInventoryDocId(storeId, itemId);
  const existing = await getDoc(INVENTORY_COLLECTION, docId);
  if (!existing) {
    throw new Error(`Inventory item "${itemId}" not found for store "${storeId}"`);
  }
  const payload = { ...updates };
  if (payload.stock !== undefined || payload.min !== undefined) {
    const stock = payload.stock !== undefined ? Number(payload.stock) : existing.stock;
    const min = payload.min !== undefined ? Number(payload.min) : existing.min;
    payload.status = calculateInventoryStatus(stock, min);
  }
  payload.updatedAt = new Date().toISOString();
  return updateDoc(INVENTORY_COLLECTION, docId, payload);
};

/**
 * Retrieve inventory audit history.
 */
const getInventoryHistory = async (storeId, options = {}) => {
  if (!storeId || typeof storeId !== 'string') return [];
  const entries = await queryDocs(HISTORY_COLLECTION, (ref) =>
    ref.where('storeId', '==', storeId.trim())
  );
  return entries.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Safely delete an inventory record.
 */
const deleteInventoryItem = async (storeId, itemId) => {
  const docId = getInventoryDocId(storeId, itemId);
  const existing = await getDoc(INVENTORY_COLLECTION, docId);
  if (!existing) {
    throw new Error(`Inventory item "${itemId}" not found for store "${storeId}"`);
  }
  await deleteDoc(INVENTORY_COLLECTION, docId);
  return true;
};

module.exports = {
  INVENTORY_COLLECTION,
  HISTORY_COLLECTION,
  getInventoryDocId,
  calculateInventoryStatus,
  getStoreInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  getInventoryHistory,
  deductStockTransactional,
  transferDefreezeToFreshTransactional,
  recordDamageWasteTransactional,
  deleteInventoryItem,
};


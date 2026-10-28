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

// In-memory cache for dark store names to ensure fast and enriched audit logs
let cachedStoreNames = null;
let cachedStoreNamesExpiry = 0;

const getStoreNameMap = async () => {
  const now = Date.now();
  if (cachedStoreNames && now < cachedStoreNamesExpiry) {
    return cachedStoreNames;
  }
  try {
    const db = getDb();
    const snap = await db.collection('stores').get();
    const map = {};
    snap.forEach((doc) => {
      const d = doc.data();
      const name = d.name || d.storeName || doc.id;
      map[doc.id] = name;
      if (d.storeId) {
        map[d.storeId] = name;
      }
    });
    cachedStoreNames = map;
    cachedStoreNamesExpiry = now + 5 * 60 * 1000;
    return map;
  } catch (err) {
    console.warn('[Inventory] Failed to load store name map:', err.message);
    return cachedStoreNames || {};
  }
};

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
 * Helper to normalize product and inventory names for robust matching.
 */
const normalizeItemName = (str) => {
  return (str || '')
    .toLowerCase()
    .replace(/\b(\.?[0-9]+(\.[0-9]+)?\s*(kg|gm|g|gram|grams|ml|l|pcs|pieces))\b/gi, '')
    .replace(/[().,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Smart matcher linking a cart/order item to a store's butchery inventory item.
 */
const matchCartItemToInventory = (cartItem, invList) => {
  if (!invList || invList.length === 0) return null;
  const normProd = normalizeItemName(cartItem.name);
  const prodWords = normProd.split(' ').filter((w) => w.length > 2);

  for (const inv of invList) {
    if (inv.itemId === cartItem.id || inv.itemId === cartItem.productId) return inv;
    const normInv = normalizeItemName(inv.item);
    if (normInv === normProd || normInv.includes(normProd) || normProd.includes(normInv)) {
      return inv;
    }
  }

  let best = null;
  let bestScore = 0;
  for (const inv of invList) {
    const normInv = normalizeItemName(inv.item);
    const invWords = normInv.split(' ').filter((w) => w.length > 2);
    let score = 0;
    for (const w of prodWords) {
      if (invWords.includes(w)) score++;
    }
    if (score > bestScore && score >= 1) {
      bestScore = score;
      best = inv;
    }
  }
  return bestScore >= 1 ? best : null;
};

/**
 * Parse weight string (e.g. '500g', '500 gm', '1kg', '250g', '1.5 kg') to kg number.
 */
const parseWeightInKg = (weightStr) => {
  if (typeof weightStr === 'number') {
    if (isNaN(weightStr) || weightStr <= 0) return 1.0;
    if (weightStr >= 50) return Math.round((weightStr / 1000) * 1000) / 1000;
    return weightStr;
  }
  if (!weightStr || typeof weightStr !== 'string') return 1.0;

  const cleaned = weightStr.trim().toLowerCase();
  const match = cleaned.match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|g|gm|gram|grams)?/i);
  if (!match) return 1.0;

  const val = parseFloat(match[1]);
  if (isNaN(val) || val <= 0) return 1.0;

  const unit = (match[2] || '').toLowerCase();
  if (['g', 'gm', 'gram', 'grams'].includes(unit)) {
    return Math.round((val / 1000) * 1000) / 1000;
  }
  return val;
};

/**
 * Calculate required quantity or weight for an order item based on inventory unit.
 */
const getItemRequiredAmount = (item, inventoryUnit = 'kg') => {
  const qty = Math.max(1, Number(item.quantity) || 1);
  const weightStr = item.netWeight || item.weight || item.selectedWeight || item.packSize || '';

  if (inventoryUnit === 'pcs' || inventoryUnit === 'pieces') {
    const pcsMatch = (weightStr || '').match(/([0-9]+)\s*(pcs|pieces|pc|eggs)/i);
    const pcsPerPack = pcsMatch ? parseInt(pcsMatch[1], 10) : 1;
    return qty * pcsPerPack;
  }

  const packWeightKg = parseWeightInKg(weightStr);
  return Math.round(qty * packWeightKg * 1000) / 1000;
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
const createInventoryItem = async (data = {}, user = null) => {
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

  const doc = await createDoc(INVENTORY_COLLECTION, docId, payload, { overwrite: false });

  // If initial stock is provided, record fresh_stock_added in inventory_history
  if (stock > 0) {
    try {
      const storeNameMap = await getStoreNameMap();
      const storeName = storeNameMap[storeId] || storeId;
      const historyRef = getDb().collection(HISTORY_COLLECTION).doc();
      const now = new Date().toISOString();
      await createDoc(HISTORY_COLLECTION, historyRef.id, {
        id: historyRef.id,
        _id: historyRef.id,
        storeId,
        storeName,
        itemId,
        productName: data.item.trim(),
        category: (data.category || 'fresh').trim(),
        classification: 'fresh',
        actionType: 'fresh_stock_added',
        quantity: stock,
        unit: (data.unit || 'kg').trim(),
        previousQuantity: 0,
        resultingQuantity: stock,
        sourceClassification: null,
        destinationClassification: 'fresh',
        reason: data.reason || 'Initial fresh stock added',
        actor: user ? {
          userId: user.id || user._id || null,
          name: user.name || 'Store Admin',
          role: user.role || 'storeadmin',
          email: user.email || '',
        } : { name: 'Store Admin', role: 'storeadmin' },
        createdAt: now,
      });
    } catch (logErr) {
      console.warn('[Inventory] Failed to log initial stock creation:', logErr.message);
    }
  }

  return doc;
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
 * Record returned meat directly to Waste stock without deducting from fresh stock
 * (since it was already deducted when the customer placed the order).
 * In full compliance with FSSAI hygiene standards - returned meat is never restocked.
 */
const recordReturnedMeatToWasteTransactional = async ({
  storeId,
  itemId,
  quantity,
  reason = 'Customer Return - Freshness Guarantee',
  orderId = '',
  requestId = '',
  actor = null,
}) => {
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Waste quantity must be a positive number');
  }

  const db = getDb();
  const docId = getInventoryDocId(storeId, itemId);
  const docRef = db.collection(INVENTORY_COLLECTION).doc(docId);

  return runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    let productName = 'Returned Fresh Meat';
    let unit = 'kg';
    let currentWaste = 0;

    if (snap.exists) {
      const data = snap.data();
      productName = data.item || productName;
      unit = data.unit || unit;
      currentWaste = Number(data.wasteStock) || 0;
      const newWaste = Math.round((currentWaste + qty) * 1000) / 1000;

      transaction.update(docRef, {
        wasteStock: newWaste,
        updatedAt: new Date().toISOString(),
      });
    }

    // Always create an immutable inventory history entry
    const historyRef = db.collection(HISTORY_COLLECTION).doc();
    const historyPayload = {
      id: historyRef.id,
      _id: historyRef.id,
      storeId,
      itemId,
      productName,
      classification: 'waste',
      actionType: 'return_waste',
      quantity: qty,
      unit,
      sourceClassification: 'customer_return',
      destinationClassification: 'waste',
      reason,
      notes: `Order #${orderId} - Return Request #${requestId}`,
      actor: actor ? {
        userId: actor.id || actor._id || null,
        name: actor.name || 'Store Admin',
        role: actor.role || 'storeadmin',
      } : { name: 'System / Reverse Pickup', role: 'system' },
      createdAt: new Date().toISOString(),
    };
    transaction.set(historyRef, historyPayload);

    return {
      success: true,
      wasteAdded: qty,
      productName,
      historyId: historyRef.id,
    };
  });
};


/**
 * Safely update an inventory record with automatic audit history logging.
 */
const updateInventoryItem = async (storeId, itemId, updates = {}, user = null, reason = '') => {
  const docId = getInventoryDocId(storeId, itemId);
  const existing = await getDoc(INVENTORY_COLLECTION, docId);
  if (!existing) {
    throw new Error(`Inventory item "${itemId}" not found for store "${storeId}"`);
  }
  const payload = { ...updates };
  const oldStock = Number(existing.stock) || 0;
  const oldDefreeze = Number(existing.defreezeStock) || 0;

  if (payload.stock !== undefined || payload.min !== undefined) {
    const stock = payload.stock !== undefined ? Number(payload.stock) : existing.stock;
    const min = payload.min !== undefined ? Number(payload.min) : existing.min;
    payload.status = calculateInventoryStatus(stock, min);
  }
  payload.updatedAt = new Date().toISOString();
  const updated = await updateDoc(INVENTORY_COLLECTION, docId, payload);

  // Check if fresh stock was changed directly (e.g. morning delivery / restock)
  if (payload.stock !== undefined) {
    const newStock = Number(payload.stock);
    const delta = Math.round((newStock - oldStock) * 1000) / 1000;
    if (delta !== 0) {
      try {
        const isIncrease = delta > 0;
        const storeNameMap = await getStoreNameMap();
        const storeName = storeNameMap[storeId] || storeId;
        const historyRef = getDb().collection(HISTORY_COLLECTION).doc();
        const now = new Date().toISOString();
        await createDoc(HISTORY_COLLECTION, historyRef.id, {
          id: historyRef.id,
          _id: historyRef.id,
          storeId,
          storeName,
          itemId,
          productName: existing.item,
          category: existing.category || '',
          classification: 'fresh',
          actionType: isIncrease ? 'fresh_stock_added' : 'stock_adjustment',
          quantity: Math.abs(delta),
          unit: existing.unit || 'kg',
          previousQuantity: oldStock,
          resultingQuantity: newStock,
          sourceClassification: isIncrease ? null : 'fresh',
          destinationClassification: isIncrease ? 'fresh' : null,
          reason: reason || (isIncrease ? `Restocked ${Math.abs(delta)} ${existing.unit || 'kg'} fresh inventory` : `Stock adjusted by ${delta} ${existing.unit || 'kg'}`),
          actor: user ? {
            userId: user.id || user._id || null,
            name: user.name || 'Store Admin',
            role: user.role || 'storeadmin',
            email: user.email || '',
          } : { name: 'Store Admin', role: 'storeadmin' },
          createdAt: now,
        });
      } catch (logErr) {
        console.warn('[Inventory] Failed to log direct stock update:', logErr.message);
      }
    }
  }

  // Check if defreeze stock was changed directly
  if (payload.defreezeStock !== undefined) {
    const newDefreeze = Number(payload.defreezeStock);
    const deltaDefreeze = Math.round((newDefreeze - oldDefreeze) * 1000) / 1000;
    if (deltaDefreeze > 0) {
      try {
        const storeNameMap = await getStoreNameMap();
        const storeName = storeNameMap[storeId] || storeId;
        const historyRef = getDb().collection(HISTORY_COLLECTION).doc();
        const now = new Date().toISOString();
        await createDoc(HISTORY_COLLECTION, historyRef.id, {
          id: historyRef.id,
          _id: historyRef.id,
          storeId,
          storeName,
          itemId,
          productName: existing.item,
          category: existing.category || '',
          classification: 'defreeze',
          actionType: 'defreeze_stock_added',
          quantity: deltaDefreeze,
          unit: existing.unit || 'kg',
          previousQuantity: oldDefreeze,
          resultingQuantity: newDefreeze,
          sourceClassification: null,
          destinationClassification: 'defreeze',
          reason: reason || `Added ${deltaDefreeze} ${existing.unit || 'kg'} to De-Freeze inventory`,
          actor: user ? {
            userId: user.id || user._id || null,
            name: user.name || 'Store Admin',
            role: user.role || 'storeadmin',
            email: user.email || '',
          } : { name: 'Store Admin', role: 'storeadmin' },
          createdAt: now,
        });
      } catch (logErr) {
        console.warn('[Inventory] Failed to log defreeze stock update:', logErr.message);
      }
    }
  }

  return updated;
};

/**
 * Retrieve inventory audit history with comprehensive filtering.
 * Supports single store (Store Admin) and cross-store (Super Admin).
 */
const getInventoryHistory = async (storeId = null, options = {}) => {
  const {
    itemId,
    actionType,
    classification,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = options;

  let queryBuilder = (ref) => {
    let q = ref;
    if (storeId && storeId !== 'all') {
      q = q.where('storeId', '==', storeId.trim());
    }
    return q;
  };

  let entries = await queryDocs(HISTORY_COLLECTION, queryBuilder);
  const storeNames = await getStoreNameMap();

  // Enrich missing storeName
  entries = entries.map((e) => ({
    ...e,
    storeName: e.storeName || storeNames[e.storeId] || e.storeId || 'Dark Store',
  }));

  // Filtering by itemId
  if (itemId && itemId.trim()) {
    entries = entries.filter((h) => h.itemId === itemId.trim());
  }

  // Filtering by actionType
  if (actionType && actionType !== 'all') {
    entries = entries.filter((h) => h.actionType === actionType);
  }

  // Filtering by classification
  if (classification && classification !== 'all') {
    entries = entries.filter(
      (h) =>
        h.classification === classification ||
        h.sourceClassification === classification ||
        h.destinationClassification === classification
    );
  }

  // Date Range Filtering (Inclusive of full start and end dates)
  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      entries = entries.filter((h) => {
        if (!h.createdAt) return false;
        const d = new Date(h.createdAt);
        return d >= start;
      });
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      // Include the entire end date till 23:59:59.999
      end.setHours(23, 59, 59, 999);
      entries = entries.filter((h) => {
        if (!h.createdAt) return false;
        const d = new Date(h.createdAt);
        return d <= end;
      });
    }
  }

  // Keyword Search across product, item ID, store, reason, order ID, and user
  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    entries = entries.filter(
      (h) =>
        (h.productName && h.productName.toLowerCase().includes(s)) ||
        (h.itemId && h.itemId.toLowerCase().includes(s)) ||
        (h.storeName && h.storeName.toLowerCase().includes(s)) ||
        (h.storeId && h.storeId.toLowerCase().includes(s)) ||
        (h.reason && h.reason.toLowerCase().includes(s)) ||
        (h.notes && h.notes.toLowerCase().includes(s)) ||
        (h.orderId && h.orderId.toLowerCase().includes(s)) ||
        (h.actor?.name && h.actor.name.toLowerCase().includes(s))
    );
  }

  // Sort latest first
  entries.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const total = entries.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const totalPages = Math.ceil(total / limitNum) || 1;
  const skip = (pageNum - 1) * limitNum;
  const paginated = entries.slice(skip, skip + limitNum);

  return {
    total,
    page: pageNum,
    totalPages,
    limit: limitNum,
    count: paginated.length,
    history: paginated,
  };
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
  normalizeItemName,
  matchCartItemToInventory,
  parseWeightInKg,
  getItemRequiredAmount,
  getStoreInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  getInventoryHistory,
  deductStockTransactional,
  transferDefreezeToFreshTransactional,
  recordDamageWasteTransactional,
  recordReturnedMeatToWasteTransactional,
  deleteInventoryItem,
};


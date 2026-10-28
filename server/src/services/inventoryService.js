// Pure inventory calculation & matcher utilities

/**
 * Helper to normalize product and inventory names for robust matching.
 * Strips weights, pack units, punctuation, and extra whitespace.
 */
function normalizeItemName(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\b(\.?[0-9]+(\.[0-9]+)?\s*(kg|gm|g|gram|grams|ml|l|pcs|pieces))\b/gi, '')
    .replace(/[().,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Smart matcher linking a cart/order item to a store's butchery inventory item.
 */
function matchCartItemToInventory(cartItem, invList) {
  if (!invList || invList.length === 0) return null;
  const normProd = normalizeItemName(cartItem.name);
  const prodWords = normProd.split(' ').filter((w) => w.length > 2);

  // 1. Direct ID match or exact normalized match
  for (const inv of invList) {
    if (inv.itemId === cartItem.id || inv.itemId === cartItem.productId) return inv;
    const normInv = normalizeItemName(inv.item);
    if (normInv === normProd || normInv.includes(normProd) || normProd.includes(normInv)) {
      return inv;
    }
  }

  // 2. Keyword score matching
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
}

/**
 * Parse weight string (e.g. '500g', '500 gm', '1kg', '250g', '1.5 kg') to kg number.
 * Defaults to 1.0 kg if invalid or unspecified.
 */
function parseWeightInKg(weightStr) {
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
}

/**
 * Calculate required quantity or weight for an order item based on inventory unit.
 */
function getItemRequiredAmount(item, inventoryUnit = 'kg') {
  const qty = Math.max(1, Number(item.quantity) || 1);
  const weightStr = item.netWeight || item.weight || item.selectedWeight || item.packSize || '';

  if (inventoryUnit === 'pcs' || inventoryUnit === 'pieces') {
    const pcsMatch = (weightStr || '').match(/([0-9]+)\s*(pcs|pieces|pc|eggs)/i);
    const pcsPerPack = pcsMatch ? parseInt(pcsMatch[1], 10) : 1;
    return qty * pcsPerPack;
  }

  const packWeightKg = parseWeightInKg(weightStr);
  return Math.round(qty * packWeightKg * 1000) / 1000;
}

/**
 * Determine inventory status based on stock and min threshold.
 */
function calculateInventoryStatus(stock, minThreshold = 10) {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= minThreshold) return 'Low Stock';
  return 'In Stock';
}

/**
 * Perform atomic validation and stock deduction for an order.
 * Deducts strictly from Fresh Inventory (item.stock).
 * Prevents race conditions and negative stock via atomic MongoDB findOneAndUpdate with condition { stock: { $gte: required } }.
 * If any item fails, rolls back all previous deductions and returns success: false.
 */
async function validateAndDeductInventory(storeId, items, orderId = null, actor = null) {
  if (!storeId || !Array.isArray(items) || items.length === 0) {
    return { success: true, deductedItems: [] };
  }

  // 1. Fetch current inventory catalog for this specific store
  const storeInventory = await Inventory.find({ storeId });
  if (!storeInventory || storeInventory.length === 0) {
    return {
      success: false,
      message: `Store ${storeId} does not have an active butchery inventory catalog.`,
    };
  }

  // 2. Map and aggregate order items by inventory record ID
  const requirementsByInvId = new Map();

  for (const item of items) {
    const matchedInv = matchCartItemToInventory(item, storeInventory);
    if (!matchedInv) {
      return {
        success: false,
        message: `Item "${item.name || 'Selected product'}" is not available in the store inventory catalog.`,
      };
    }

    const requiredAmount = getItemRequiredAmount(item, matchedInv.unit);
    const invKey = matchedInv._id.toString();

    if (requirementsByInvId.has(invKey)) {
      const existing = requirementsByInvId.get(invKey);
      existing.requiredAmount = Math.round((existing.requiredAmount + requiredAmount) * 1000) / 1000;
      existing.orderItems.push(item);
    } else {
      requirementsByInvId.set(invKey, {
        invDoc: matchedInv,
        requiredAmount,
        orderItems: [item],
      });
    }
  }

  // 3. Pre-check Fresh stock levels before attempting deduction
  for (const entry of requirementsByInvId.values()) {
    const { invDoc, requiredAmount } = entry;
    if (invDoc.status === 'Out of Stock' || invDoc.stock <= 0) {
      return {
        success: false,
        message: `"${invDoc.item}" is currently out of stock in Fresh Inventory at this store.`,
      };
    }
    if (invDoc.stock < requiredAmount) {
      return {
        success: false,
        message: `Insufficient Fresh stock for "${invDoc.item}". Requested: ${requiredAmount} ${invDoc.unit || 'kg'}, Available: ${invDoc.stock} ${invDoc.unit || 'kg'}.`,
      };
    }
  }

  // 4. Atomic conditional deductions with rollback tracking
  const successfulDeductions = [];

  for (const entry of requirementsByInvId.values()) {
    const { invDoc, requiredAmount } = entry;

    // Concurrency guard: atomically decrement only if fresh stock >= requiredAmount
    const updated = await Inventory.findOneAndUpdate(
      {
        _id: invDoc._id,
        stock: { $gte: requiredAmount },
      },
      {
        $inc: { stock: -requiredAmount },
      },
      { new: true }
    );

    if (!updated) {
      // Race condition detected! Rollback all previously deducted items for this order:
      for (const ded of successfulDeductions) {
        await Inventory.findOneAndUpdate(
          { _id: ded.invId },
          { $inc: { stock: ded.deductedAmount } }
        ).catch((err) => console.error('[InventoryService] Rollback error:', err.message));
      }

      // Re-fetch current stock to give user an accurate error message
      const latestInv = await Inventory.findById(invDoc._id).lean();
      const currentStock = latestInv ? latestInv.stock : 0;
      return {
        success: false,
        message: `Stock conflict: "${invDoc.item}" has only ${currentStock} ${invDoc.unit || 'kg'} available in Fresh Inventory. Please adjust your quantity.`,
      };
    }

    // Update status based on remaining stock
    const newStatus = calculateInventoryStatus(updated.stock, updated.min);
    if (updated.status !== newStatus) {
      updated.status = newStatus;
      await updated.save();
    }

    successfulDeductions.push({
      invId: updated._id,
      itemId: updated.itemId,
      item: updated.item,
      category: updated.category,
      deductedAmount: requiredAmount,
      unit: updated.unit || 'kg',
      remainingStock: updated.stock,
      status: updated.status,
      storeId: updated.storeId,
    });

    // Record in InventoryHistory
    try {
      await InventoryHistory.create({
        storeId: updated.storeId,
        itemId: updated.itemId,
        productName: updated.item,
        category: updated.category || '',
        classification: 'fresh',
        actionType: 'order_deduction',
        quantity: requiredAmount,
        unit: updated.unit || 'kg',
        previousQuantity: Math.round((updated.stock + requiredAmount) * 1000) / 1000,
        resultingQuantity: updated.stock,
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
      });
    } catch (histErr) {
      console.warn('[InventoryService] History logging warning:', histErr.message);
    }
  }

  // 5. Emit real-time inventory updates via Socket.IO
  try {
    const { emitInventoryUpdate } = require('../socket');
    emitInventoryUpdate(storeId, successfulDeductions);
  } catch (socketErr) {
    console.warn('[InventoryService] Socket emission warning:', socketErr.message);
  }

  return {
    success: true,
    deductedItems: successfulDeductions,
  };
}

/**
 * Rollback previously deducted inventory items in case of subsequent order creation failure.
 */
async function rollbackDeductedInventory(deductions) {
  if (!Array.isArray(deductions) || deductions.length === 0) return;

  for (const ded of deductions) {
    const updated = await Inventory.findOneAndUpdate(
      { _id: ded.invId },
      { $inc: { stock: ded.deductedAmount } },
      { new: true }
    );
    if (updated) {
      const newStatus = calculateInventoryStatus(updated.stock, updated.min);
      if (updated.status !== newStatus) {
        updated.status = newStatus;
        await updated.save();
      }
    }
  }

  const storeId = deductions[0]?.storeId;
  if (storeId) {
    try {
      const { emitInventoryUpdate } = require('../socket');
      emitInventoryUpdate(storeId, deductions);
    } catch (socketErr) {
      console.warn('[InventoryService] Socket rollback emission warning:', socketErr.message);
    }
  }
}

/**
 * Restore inventory items when an order is cancelled.
 */
async function restoreOrderInventory(order, actor = null) {
  if (!order || order.isInventoryRestocked || !order.isInventoryDeducted) {
    return { success: false, message: 'Order is not eligible for stock restoration' };
  }

  const storeId = order.storeId;
  const items = order.items;
  if (!storeId || !Array.isArray(items) || items.length === 0) {
    return { success: true, restoredItems: [] };
  }

  const storeInventory = await Inventory.find({ storeId });
  if (!storeInventory || storeInventory.length === 0) {
    return { success: false, message: 'Store inventory not found' };
  }

  const restoredItems = [];

  for (const item of items) {
    const matchedInv = matchCartItemToInventory(item, storeInventory);
    if (!matchedInv) continue;

    const restoreAmount = getItemRequiredAmount(item, matchedInv.unit);
    const updated = await Inventory.findOneAndUpdate(
      { _id: matchedInv._id },
      { $inc: { stock: restoreAmount } },
      { new: true }
    );

    if (updated) {
      const newStatus = calculateInventoryStatus(updated.stock, updated.min);
      if (updated.status !== newStatus) {
        updated.status = newStatus;
        await updated.save();
      }

      restoredItems.push({
        invId: updated._id,
        itemId: updated.itemId,
        item: updated.item,
        restoredAmount: restoreAmount,
        stock: updated.stock,
        unit: updated.unit || 'kg',
        status: updated.status,
        storeId,
      });

      // Record in InventoryHistory
      try {
        await InventoryHistory.create({
          storeId,
          itemId: updated.itemId,
          productName: updated.item,
          category: updated.category || '',
          classification: 'fresh',
          actionType: 'order_restock',
          quantity: restoreAmount,
          unit: updated.unit || 'kg',
          previousQuantity: Math.round((updated.stock - restoreAmount) * 1000) / 1000,
          resultingQuantity: updated.stock,
          sourceClassification: null,
          destinationClassification: 'fresh',
          reason: `Restocked — Order #${order.orderId} cancelled`,
          orderId: order.orderId,
          actor: actor ? {
            userId: actor.userId || null,
            name: actor.name || 'Store Admin',
            role: actor.role || 'storeadmin',
            email: actor.email || '',
          } : { name: 'Store Admin', role: 'storeadmin' },
        });
      } catch (histErr) {
        console.warn('[InventoryService] Restock history warning:', histErr.message);
      }
    }
  }

  order.isInventoryRestocked = true;
  await order.save();

  try {
    const { emitInventoryUpdate } = require('../socket');
    emitInventoryUpdate(storeId, restoredItems);
  } catch (socketErr) {
    console.warn('[InventoryService] Socket restore emission warning:', socketErr.message);
  }

  return { success: true, restoredItems };
}

/**
 * Transfer a specified quantity from De-Freeze Inventory to Fresh Inventory.
 * Atomically decrements De-Freeze and increments Fresh stock.
 */
async function transferDefreezeToFresh({ storeId, itemId, quantity, user, notes }) {
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    return { success: false, message: 'Transfer quantity must be a positive number.' };
  }

  const query = {
    storeId,
    $or: [{ itemId }, { _id: itemId.match(/^[0-9a-fA-F]{24}$/) ? itemId : null }],
  };

  const item = await Inventory.findOne(query);
  if (!item) {
    return { success: false, message: 'Inventory item not found for this store.' };
  }

  const availableDefreeze = Number(item.defreezeStock) || 0;
  if (availableDefreeze < qty) {
    return {
      success: false,
      message: `Insufficient De-Freeze stock. Available: ${availableDefreeze} ${item.unit || 'kg'}, Requested: ${qty} ${item.unit || 'kg'}.`,
    };
  }

  // Atomically decrement defreezeStock and increment fresh stock
  const updated = await Inventory.findOneAndUpdate(
    {
      _id: item._id,
      defreezeStock: { $gte: qty },
    },
    {
      $inc: { defreezeStock: -qty, stock: qty },
      $set: { lastRestocked: `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` },
    },
    { new: true }
  );

  if (!updated) {
    return { success: false, message: 'Stock update conflict. Please try again.' };
  }

  const newStatus = calculateInventoryStatus(updated.stock, updated.min);
  if (updated.status !== newStatus) {
    updated.status = newStatus;
    await updated.save();
  }

  // Record in InventoryHistory
  const prevDefreeze = Math.round((updated.defreezeStock + qty) * 1000) / 1000;

  try {
    await InventoryHistory.create({
      storeId: updated.storeId,
      itemId: updated.itemId,
      productName: updated.item,
      category: updated.category || '',
      classification: 'transfer',
      actionType: 'transfer_defreeze_to_fresh',
      quantity: qty,
      unit: updated.unit || 'kg',
      previousQuantity: prevDefreeze,
      resultingQuantity: updated.defreezeStock,
      sourceClassification: 'defreeze',
      destinationClassification: 'fresh',
      reason: notes?.trim() || `Moved ${qty} ${updated.unit || 'kg'} from De-Freeze to Fresh`,
      notes: notes?.trim() || '',
      actor: user ? {
        userId: user._id || user.id,
        name: user.name || 'Store Admin',
        role: user.role || 'storeadmin',
        email: user.email || '',
      } : { name: 'Store Admin', role: 'storeadmin' },
    });
  } catch (histErr) {
    console.warn('[InventoryService] Transfer history warning:', histErr.message);
  }

  // Emit socket update
  try {
    const { emitInventoryUpdate } = require('../socket');
    emitInventoryUpdate(updated.storeId, [updated]);
  } catch (socketErr) {
    console.warn('[InventoryService] Socket emission warning:', socketErr.message);
  }

  return {
    success: true,
    item: updated,
    message: `Successfully moved ${qty} ${updated.unit || 'kg'} from De-Freeze to Fresh Inventory.`,
  };
}

/**
 * Record Damaged, Spoiled, Expired, or Wasted stock.
 * Deducts from the selected source (Fresh or De-Freeze) and increments wasteStock.
 */
async function recordDamageWaste({ storeId, itemId, sourceClassification = 'fresh', quantity, reason = 'Damaged', notes, user }) {
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    return { success: false, message: 'Waste quantity must be a positive number.' };
  }

  const validSources = ['fresh', 'defreeze'];
  const src = validSources.includes(sourceClassification) ? sourceClassification : 'fresh';

  const query = {
    storeId,
    $or: [{ itemId }, { _id: itemId.match(/^[0-9a-fA-F]{24}$/) ? itemId : null }],
  };

  const item = await Inventory.findOne(query);
  if (!item) {
    return { success: false, message: 'Inventory item not found for this store.' };
  }

  const currentAvailable = src === 'fresh' ? Number(item.stock || 0) : Number(item.defreezeStock || 0);
  if (currentAvailable < qty) {
    return {
      success: false,
      message: `Insufficient stock in ${src === 'fresh' ? 'Fresh' : 'De-Freeze'} Inventory to record waste. Available: ${currentAvailable} ${item.unit || 'kg'}, Requested: ${qty} ${item.unit || 'kg'}.`,
    };
  }

  const updateCondition = { _id: item._id };
  const updateOp = {};
  if (src === 'fresh') {
    updateCondition.stock = { $gte: qty };
    updateOp.$inc = { stock: -qty, wasteStock: qty };
  } else {
    updateCondition.defreezeStock = { $gte: qty };
    updateOp.$inc = { defreezeStock: -qty, wasteStock: qty };
  }

  const updated = await Inventory.findOneAndUpdate(updateCondition, updateOp, { new: true });
  if (!updated) {
    return { success: false, message: 'Stock update conflict. Please try again.' };
  }

  if (src === 'fresh') {
    const newStatus = calculateInventoryStatus(updated.stock, updated.min);
    if (updated.status !== newStatus) {
      updated.status = newStatus;
      await updated.save();
    }
  }

  const prevSourceStock = src === 'fresh'
    ? Math.round((updated.stock + qty) * 1000) / 1000
    : Math.round((updated.defreezeStock + qty) * 1000) / 1000;
  const resSourceStock = src === 'fresh' ? updated.stock : updated.defreezeStock;

  try {
    await InventoryHistory.create({
      storeId: updated.storeId,
      itemId: updated.itemId,
      productName: updated.item,
      category: updated.category || '',
      classification: 'waste',
      actionType: 'record_waste',
      quantity: qty,
      unit: updated.unit || 'kg',
      previousQuantity: prevSourceStock,
      resultingQuantity: resSourceStock,
      sourceClassification: src,
      destinationClassification: 'waste',
      reason: reason || 'Damaged / Spoiled',
      notes: notes?.trim() || '',
      actor: user ? {
        userId: user._id || user.id,
        name: user.name || 'Store Admin',
        role: user.role || 'storeadmin',
        email: user.email || '',
      } : { name: 'Store Admin', role: 'storeadmin' },
    });
  } catch (histErr) {
    console.warn('[InventoryService] Waste history warning:', histErr.message);
  }

  try {
    const { emitInventoryUpdate } = require('../socket');
    emitInventoryUpdate(updated.storeId, [updated]);
  } catch (socketErr) {
    console.warn('[InventoryService] Socket emission warning:', socketErr.message);
  }

  return {
    success: true,
    item: updated,
    message: `Recorded ${qty} ${updated.unit || 'kg'} as ${reason} from ${src === 'fresh' ? 'Fresh' : 'De-Freeze'} Inventory.`,
  };
}

/**
 * Adjust stock quantities for Fresh or De-Freeze Inventory.
 * Operation: 'add' | 'reduce' | 'set'
 */
async function adjustStockItem({ storeId, itemId, classification = 'fresh', operation = 'add', quantity, min, reason, user }) {
  const query = {
    storeId,
    $or: [{ itemId }, { _id: itemId.match(/^[0-9a-fA-F]{24}$/) ? itemId : null }],
  };

  const item = await Inventory.findOne(query);
  if (!item) {
    return { success: false, message: 'Inventory item not found.' };
  }

  const isFresh = classification === 'fresh';
  const currentVal = isFresh ? Number(item.stock || 0) : Number(item.defreezeStock || 0);
  const inputQty = parseFloat(quantity);

  let targetVal = currentVal;
  if (!isNaN(inputQty)) {
    if (operation === 'add') {
      targetVal = Math.round((currentVal + Math.max(0, inputQty)) * 1000) / 1000;
    } else if (operation === 'reduce') {
      targetVal = Math.max(0, Math.round((currentVal - Math.max(0, inputQty)) * 1000) / 1000);
    } else if (operation === 'set') {
      targetVal = Math.max(0, Math.round(inputQty * 1000) / 1000);
    }
  }

  if (isFresh) {
    item.stock = targetVal;
    if (min !== undefined && min !== null && min !== '') {
      const parsedMin = parseFloat(min);
      if (!isNaN(parsedMin)) item.min = Math.max(0, parsedMin);
    }
    item.status = calculateInventoryStatus(item.stock, item.min);
  } else {
    item.defreezeStock = targetVal;
  }

  item.lastRestocked = `Today ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  await item.save();

  // Log to InventoryHistory
  const actionTypeMap = { add: 'add_stock', reduce: 'reduce_stock', set: 'set_stock' };
  const changedQty = Math.abs(Math.round((targetVal - currentVal) * 1000) / 1000);

  if (changedQty > 0 || operation === 'set') {
    try {
      await InventoryHistory.create({
        storeId: item.storeId,
        itemId: item.itemId,
        productName: item.item,
        category: item.category || '',
        classification: isFresh ? 'fresh' : 'defreeze',
        actionType: actionTypeMap[operation] || 'adjust_stock',
        quantity: changedQty,
        unit: item.unit || 'kg',
        previousQuantity: currentVal,
        resultingQuantity: targetVal,
        sourceClassification: isFresh ? 'fresh' : 'defreeze',
        destinationClassification: null,
        reason: reason?.trim() || (operation === 'add' ? 'New stock received' : `${operation.toUpperCase()} stock adjustment`),
        actor: user ? {
          userId: user._id || user.id,
          name: user.name || 'Store Admin',
          role: user.role || 'storeadmin',
          email: user.email || '',
        } : { name: 'Store Admin', role: 'storeadmin' },
      });
    } catch (histErr) {
      console.warn('[InventoryService] Adjust stock history warning:', histErr.message);
    }
  }

  try {
    const { emitInventoryUpdate } = require('../socket');
    emitInventoryUpdate(item.storeId, [item]);
  } catch (socketErr) {
    console.warn('[InventoryService] Socket emission warning:', socketErr.message);
  }

  return { success: true, item };
}

module.exports = {
  normalizeItemName,
  matchCartItemToInventory,
  parseWeightInKg,
  getItemRequiredAmount,
  calculateInventoryStatus,
  validateAndDeductInventory,
  rollbackDeductedInventory,
  restoreOrderInventory,
  transferDefreezeToFresh,
  recordDamageWaste,
  adjustStockItem,
};

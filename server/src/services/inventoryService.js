const Inventory = require('../models/Inventory');

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
 * Prevents race condition and negative stock via atomic MongoDB findOneAndUpdate with condition { stock: { $gte: required } }.
 * If any item fails, rolls back all previous deductions and returns success: false.
 */
async function validateAndDeductInventory(storeId, items) {
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

  // 3. Pre-check stock levels before attempting deduction
  for (const entry of requirementsByInvId.values()) {
    const { invDoc, requiredAmount } = entry;
    if (invDoc.status === 'Out of Stock' || invDoc.stock <= 0) {
      return {
        success: false,
        message: `"${invDoc.item}" is currently out of stock at this store.`,
      };
    }
    if (invDoc.stock < requiredAmount) {
      return {
        success: false,
        message: `Insufficient stock for "${invDoc.item}". Requested: ${requiredAmount} ${invDoc.unit || 'kg'}, Available: ${invDoc.stock} ${invDoc.unit || 'kg'}.`,
      };
    }
  }

  // 4. Atomic conditional deductions with rollback tracking
  const successfulDeductions = [];

  for (const entry of requirementsByInvId.values()) {
    const { invDoc, requiredAmount } = entry;

    // Concurrency guard: atomically decrement only if stock >= requiredAmount
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
        message: `Stock conflict: "${invDoc.item}" has only ${currentStock} ${invDoc.unit || 'kg'} available. Please adjust your quantity.`,
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
      deductedAmount: requiredAmount,
      unit: updated.unit || 'kg',
      remainingStock: updated.stock,
      status: updated.status,
      storeId: updated.storeId,
    });
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
async function restoreOrderInventory(order) {
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

module.exports = {
  normalizeItemName,
  matchCartItemToInventory,
  parseWeightInKg,
  getItemRequiredAmount,
  calculateInventoryStatus,
  validateAndDeductInventory,
  rollbackDeductedInventory,
  restoreOrderInventory,
};

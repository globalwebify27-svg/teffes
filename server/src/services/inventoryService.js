/**
 * Inventory Service (Pure Cloud Firestore Backend)
 * 100% Zero MongoDB dependency - Fully migrated to Google Cloud Firestore
 */

const {
  normalizeItemName,
  matchCartItemToInventory,
  parseWeightInKg,
  getItemRequiredAmount,
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
} = require('./firestore/inventory.firestore.service');

module.exports = {
  normalizeItemName,
  matchCartItemToInventory,
  parseWeightInKg,
  getItemRequiredAmount,
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

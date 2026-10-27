const {
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
} = require('../../lib/firestore');

const COLLECTION = 'cross_sell_items';

/**
 * Retrieve public cross-sell items that are active and in stock.
 * Optionally filters by storeId (or items with storeId 'all').
 */
const getPublicCrossSellItems = async (storeId = null) => {
  const items = await queryDocs(COLLECTION, (ref) => ref.where('isActive', '==', true));
  return items
    .filter((item) => {
      if (!item.inStock) return false;
      if (!storeId || storeId === 'all') return true;
      return item.storeId === 'all' || item.storeId === storeId;
    })
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
};

/**
 * Retrieve all cross-sell items for admin management.
 */
const getAdminCrossSellItems = async () => {
  const items = await queryDocs(COLLECTION);
  return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
};

/**
 * Retrieve a single cross-sell item by document ID.
 */
const getCrossSellItemById = async (id) => {
  if (!id || typeof id !== 'string') return null;
  return getDoc(COLLECTION, id.trim());
};

/**
 * Safely create a cross-sell item.
 */
const createCrossSellItem = async (data = {}) => {
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('Item name is required');
  }
  if (data.price === undefined || isNaN(Number(data.price)) || Number(data.price) < 0) {
    throw new Error('Valid non-negative price is required');
  }
  if (!data.image || typeof data.image !== 'string' || !data.image.trim()) {
    throw new Error('Item image URL is required');
  }

  const cleanId = data.id && typeof data.id === 'string' && data.id.trim()
    ? data.id.trim()
    : `cross_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const existing = await getDoc(COLLECTION, cleanId);
  if (existing) {
    throw new Error(`Cross-sell item with ID "${cleanId}" already exists`);
  }

  const payload = {
    id: cleanId,
    name: data.name.trim(),
    price: Number(data.price),
    originalPrice: Number(data.originalPrice) || 0,
    image: data.image.trim(),
    weight: (data.weight || '').trim(),
    category: (data.category || 'Essentials').trim(),
    inStock: typeof data.inStock === 'boolean' ? data.inStock : true,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    displayOrder: Number.isInteger(Number(data.displayOrder)) ? Number(data.displayOrder) : 0,
    storeId: (data.storeId || 'all').trim(),
  };

  return createDoc(COLLECTION, cleanId, payload, { overwrite: false });
};

/**
 * Safely update an existing cross-sell item.
 */
const updateCrossSellItem = async (id, updates = {}) => {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('Valid item ID is required for update');
  }

  const existing = await getDoc(COLLECTION, id.trim());
  if (!existing) {
    throw new Error(`Cross-sell item with ID "${id}" not found`);
  }

  const payload = {};
  if (updates.name !== undefined) payload.name = String(updates.name).trim();
  if (updates.price !== undefined) payload.price = Math.max(0, Number(updates.price) || 0);
  if (updates.originalPrice !== undefined) payload.originalPrice = Math.max(0, Number(updates.originalPrice) || 0);
  if (updates.image !== undefined) payload.image = String(updates.image).trim();
  if (updates.weight !== undefined) payload.weight = String(updates.weight).trim();
  if (updates.category !== undefined) payload.category = String(updates.category).trim();
  if (updates.inStock !== undefined) payload.inStock = Boolean(updates.inStock);
  if (updates.isActive !== undefined) payload.isActive = Boolean(updates.isActive);
  if (updates.displayOrder !== undefined) payload.displayOrder = Number(updates.displayOrder) || 0;
  if (updates.storeId !== undefined) payload.storeId = String(updates.storeId).trim();

  return updateDoc(COLLECTION, id.trim(), payload);
};

/**
 * Safely delete a cross-sell item.
 */
const deleteCrossSellItem = async (id) => {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('Valid item ID is required for deletion');
  }

  const existing = await getDoc(COLLECTION, id.trim());
  if (!existing) {
    throw new Error(`Cross-sell item with ID "${id}" not found`);
  }

  await deleteDoc(COLLECTION, id.trim());
  return true;
};

module.exports = {
  COLLECTION,
  getPublicCrossSellItems,
  getAdminCrossSellItems,
  getCrossSellItemById,
  createCrossSellItem,
  updateCrossSellItem,
  deleteCrossSellItem,
};

/**
 * Cross Sell Controller (Pure Cloud Firestore Backend)
 * 100% Zero MongoDB dependency - Fully migrated to Google Cloud Firestore
 */

const {
  getPublicCrossSellItems: getPublicCrossSellItemsFS,
  getAdminCrossSellItems: getAdminCrossSellItemsFS,
  createCrossSellItem: createCrossSellItemFS,
  updateCrossSellItem: updateCrossSellItemFS,
  deleteCrossSellItem: deleteCrossSellItemFS,
} = require('../services/firestore/crossSell.firestore.service');

// GET /api/cross-sell (Public for Cart in Web & Mobile App)
const getPublicCrossSellItems = async (req, res, next) => {
  try {
    const storeId = req.query.storeId || req.user?.storeId || 'all';
    const items = await getPublicCrossSellItemsFS(storeId);
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    next(error);
  }
};

// GET /api/store-admin/cross-sell (Store Admin)
const getAdminCrossSellItems = async (req, res, next) => {
  try {
    const items = await getAdminCrossSellItemsFS();
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    next(error);
  }
};

// POST /api/store-admin/cross-sell
const createCrossSellItem = async (req, res, next) => {
  try {
    const { name, price, originalPrice, image, weight, category, inStock, isActive, displayOrder } = req.body;
    if (!name || price === undefined || !image) {
      return res.status(400).json({ success: false, message: 'Name, price, and image are required.' });
    }

    const id = `cross-${name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}-${Date.now().toString().slice(-4)}`;

    const newItem = await createCrossSellItemFS({
      id,
      name,
      price: Number(price),
      originalPrice: Number(originalPrice) || 0,
      image,
      weight: weight || '',
      category: category || 'Essentials',
      inStock: inStock !== undefined ? Boolean(inStock) : true,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      displayOrder: Number(displayOrder) || 0,
      storeId: req.user?.storeId || 'all',
    });

    res.status(201).json({ success: true, message: 'Cross-sell item created successfully', data: newItem });
  } catch (error) {
    next(error);
  }
};

// PUT /api/store-admin/cross-sell/:id
const updateCrossSellItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await updateCrossSellItemFS(id, req.body);
    res.json({ success: true, message: 'Cross-sell item updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/store-admin/cross-sell/:id
const deleteCrossSellItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteCrossSellItemFS(id);
    res.json({ success: true, message: 'Cross-sell item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicCrossSellItems,
  getAdminCrossSellItems,
  createCrossSellItem,
  updateCrossSellItem,
  deleteCrossSellItem,
};

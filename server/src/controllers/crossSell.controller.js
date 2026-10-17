const CrossSellItem = require('../models/CrossSellItem');

// GET /api/cross-sell (Public for Cart in Web & Mobile App)
const getPublicCrossSellItems = async (req, res, next) => {
  try {
    const items = await CrossSellItem.find({ isActive: true, inStock: true }).sort({ displayOrder: 1, createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    next(error);
  }
};

// GET /api/store-admin/cross-sell (Store Admin)
const getAdminCrossSellItems = async (req, res, next) => {
  try {
    const items = await CrossSellItem.find().sort({ displayOrder: 1, createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    next(error);
  }
};

// POST /api/store-admin/cross-sell
const createCrossSellItem = async (req, res, next) => {
  try {
    const { name, price, originalPrice, image, weight, category, inStock, isActive } = req.body;
    if (!name || price === undefined || !image) {
      return res.status(400).json({ success: false, message: 'Name, price, and image are required.' });
    }

    const id = `cross-${name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}-${Date.now().toString().slice(-4)}`;

    const newItem = await CrossSellItem.create({
      id,
      name,
      price: Number(price),
      originalPrice: Number(originalPrice) || 0,
      image,
      weight: weight || '1 unit',
      category: category || 'Essentials',
      inStock: inStock !== undefined ? inStock : true,
      isActive: isActive !== undefined ? isActive : true,
      displayOrder: Number(req.body.displayOrder) || 0,
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
    const { name, price, originalPrice, image, weight, inStock, isActive, displayOrder } = req.body;

    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { id };
    const item = await CrossSellItem.findOne(query);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Cross-sell item not found' });
    }

    if (name !== undefined) item.name = name;
    if (price !== undefined) item.price = Number(price);
    if (originalPrice !== undefined) item.originalPrice = Number(originalPrice);
    if (image !== undefined) item.image = image;
    if (weight !== undefined) item.weight = weight;
    if (inStock !== undefined) item.inStock = Boolean(inStock);
    if (isActive !== undefined) item.isActive = Boolean(isActive);
    if (displayOrder !== undefined) item.displayOrder = Number(displayOrder);

    await item.save();

    res.json({ success: true, message: 'Cross-sell item updated successfully', data: item });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/store-admin/cross-sell/:id
const deleteCrossSellItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { id };
    const item = await CrossSellItem.findOneAndDelete(query);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Cross-sell item not found' });
    }

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

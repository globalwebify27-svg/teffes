/**
 * Staging Catalog, Stores & Master Data Controller (Firestore-backed)
 * Strictly queries Firestore services without touching MongoDB Atlas.
 */

const {
  getActiveCategories,
  getAllCategories,
  getCategoryBySlug,
} = require('../../services/firestore/category.firestore.service');
const {
  getActiveBanners,
  getAllBanners,
} = require('../../services/firestore/banner.firestore.service');
const { getAuthoritativeSettings: getSiteSettings } = require('../../services/firestore/siteSettings.firestore.service');
const {
  getActiveCrossSellItems,
  getCrossSellItemsByStore,
} = require('../../services/firestore/crossSell.firestore.service');
const {
  getProducts,
  getProductById,
  searchProducts,
} = require('../../services/firestore/product.firestore.service');
const {
  getAllStores,
  getActiveStores,
  getStoreById,
} = require('../../services/firestore/store.firestore.service');
const {
  getStoreInventory,
  getInventoryItem,
} = require('../../services/firestore/inventory.firestore.service');

// ─── Categories ─────────────────────────────────────────────────────────────
const getCategories = async (req, res, next) => {
  try {
    const categories = await getActiveCategories();
    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (err) {
    next(err);
  }
};

const getCategory = async (req, res, next) => {
  try {
    const category = await getCategoryBySlug(req.params.slug);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    return res.status(200).json({ success: true, category });
  } catch (err) {
    next(err);
  }
};

// ─── Banners ────────────────────────────────────────────────────────────────
const getBanners = async (req, res, next) => {
  try {
    const banners = await getActiveBanners();
    return res.status(200).json({
      success: true,
      count: banners.length,
      banners,
    });
  } catch (err) {
    next(err);
  }
};

// ─── SEO & Site Settings ────────────────────────────────────────────────────
const getSeoSettings = async (req, res, next) => {
  try {
    const settings = await getSiteSettings();
    return res.status(200).json({
      success: true,
      settings,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Cross Sell ─────────────────────────────────────────────────────────────
const getCrossSell = async (req, res, next) => {
  try {
    const { storeId } = req.query;
    const items = storeId
      ? await getCrossSellItemsByStore(storeId)
      : await getActiveCrossSellItems();
    return res.status(200).json({
      success: true,
      count: items.length,
      crossSellItems: items,
      items,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Products ───────────────────────────────────────────────────────────────
const listProducts = async (req, res, next) => {
  try {
    const { category, search, bestseller, sort, limit, page } = req.query;

    const result = await getProducts({
      category: category && category !== 'all' ? category.toLowerCase() : undefined,
      search: search && search.trim() ? search.trim() : undefined,
      bestseller: bestseller === 'true' ? true : undefined,
      sort,
      limit,
      page,
      all: true,
    });

    return res.status(200).json({
      success: true,
      count: result.count,
      total: result.total,
      page: result.page,
      pages: result.totalPages,
      products: result.products,
    });
  } catch (err) {
    next(err);
  }
};

const getProduct = async (req, res, next) => {
  try {
    const result = await getProductById(req.params.id);
    if (!result || !result.product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.status(200).json({
      success: true,
      product: result.product,
      related: result.related || [],
    });
  } catch (err) {
    next(err);
  }
};

// ─── Stores ─────────────────────────────────────────────────────────────────
const listStores = async (req, res, next) => {
  try {
    const stores = req.query.active === 'true'
      ? await getActiveStores()
      : await getAllStores();
    return res.status(200).json({
      success: true,
      count: stores.length,
      stores,
    });
  } catch (err) {
    next(err);
  }
};

const getStore = async (req, res, next) => {
  try {
    const store = await getStoreById(req.params.storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }
    return res.status(200).json({ success: true, store });
  } catch (err) {
    next(err);
  }
};

// ─── Inventory ──────────────────────────────────────────────────────────────
const getInventoryByStore = async (req, res, next) => {
  try {
    const inventory = await getStoreInventory(req.params.storeId);
    return res.status(200).json({
      success: true,
      count: inventory.length,
      inventory,
    });
  } catch (err) {
    next(err);
  }
};

const getInventoryByItem = async (req, res, next) => {
  try {
    const item = await getInventoryItem(req.params.storeId, req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    return res.status(200).json({ success: true, item });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCategories,
  getCategory,
  getBanners,
  getSeoSettings,
  getCrossSell,
  listProducts,
  getProduct,
  listStores,
  getStore,
  getInventoryByStore,
  getInventoryByItem,
};

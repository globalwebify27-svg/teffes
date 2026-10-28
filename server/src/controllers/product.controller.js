/**
 * Categories and Products Controller (Firestore-backed)
 * Zero dependency on MongoDB. Full Super Admin CRUD + Public Catalog endpoints.
 */

const {
  getAllCategories,
  getActiveCategories,
  getCategoryBySlug,
  createCategory: createCategoryFirestore,
  updateCategory: updateCategoryFirestore,
  deleteCategory: deleteCategoryFirestore,
} = require('../services/firestore/category.firestore.service');

const {
  getProducts: getProductsFirestore,
  getProductById: getProductByIdFirestore,
  createProduct: createProductFirestore,
  updateProduct: updateProductFirestore,
  deleteProduct: deleteProductFirestore,
} = require('../services/firestore/product.firestore.service');

/**
 * GET /api/categories
 * Retrieve all active categories
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await getActiveCategories();
    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/categories
 * Admin: create a new category
 */
const createCategory = async (req, res, next) => {
  try {
    let { name, slug, tagline, icon, image, order, isActive } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    } else {
      slug = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    const category = await createCategoryFirestore({
      name: name.trim(),
      slug,
      tagline: tagline || '',
      icon: icon || '🥩',
      image: image || '',
      order: typeof order === 'number' ? order : Number(order) || 0,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * PUT /api/categories/:id
 * Admin: update a category
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await updateCategoryFirestore(id, req.body);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/categories/:id
 * Admin: delete a category
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteCategoryFirestore(id);
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/products
 * Retrieve products with filters, sorting, and search
 */
const getProducts = async (req, res, next) => {
  try {
    const { category, search, bestseller, sort, limit = 50, page = 1, all } = req.query;

    const options = {
      all: all === 'true' || all === true,
      category: category && category !== 'all' ? category.toLowerCase() : undefined,
      bestseller: bestseller === 'true' || bestseller === true,
      search: search && search.trim() ? search.trim() : undefined,
      sort: sort || 'bestseller',
      limit: parseInt(limit, 10) || 50,
      page: parseInt(page, 10) || 1,
    };

    const result = await getProductsFirestore(options);
    const productList = Array.isArray(result) ? result : (result?.products || []);
    const totalCount = result?.total ?? productList.length;

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.status(200).json({
      success: true,
      count: productList.length,
      total: totalCount,
      page: result?.page || 1,
      totalPages: result?.totalPages || 1,
      products: productList,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/products/:id
 * Retrieve product by ID with related products
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await getProductByIdFirestore(id);
    const product = result?.product || result;

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.status(200).json({
      success: true,
      product,
      related: result?.related || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/products
 * Admin: create a new product
 */
const createProduct = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (!data.name || !data.name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }
    if (!data.category || !data.category.trim()) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }
    if (typeof data.price === 'undefined' || isNaN(Number(data.price))) {
      return res.status(400).json({ success: false, message: 'Valid price is required' });
    }
    data.price = Number(data.price);

    if (Array.isArray(data.images)) {
      data.images = data.images.map((s) => String(s).trim()).filter(Boolean);
      if (!data.image && data.images.length > 0) {
        data.image = data.images[0];
      }
    }
    if (data.image && (!data.images || data.images.length === 0)) {
      data.images = [data.image.trim()];
    }
    if (typeof data.videoURLs === 'string') {
      data.videoURLs = data.videoURLs.trim() ? [data.videoURLs.trim()] : [];
    } else if (Array.isArray(data.videoURLs)) {
      data.videoURLs = data.videoURLs.map((s) => String(s).trim()).filter(Boolean);
    }

    if (!data.image || !data.image.trim()) {
      return res.status(400).json({ success: false, message: 'Product image URL is required' });
    }

    if (!data.id || !data.id.trim()) {
      const slugBase = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      data.id = `prod-${slugBase}-${Date.now().toString().slice(-4)}`;
    }
    if (!data.originalPrice) {
      data.originalPrice = data.price;
    } else {
      data.originalPrice = Number(data.originalPrice);
    }

    if (!data.categoryLabel && data.category) {
      const catObj = await getCategoryBySlug(data.category);
      data.categoryLabel = catObj ? catObj.name : data.category.charAt(0).toUpperCase() + data.category.slice(1);
    }
    if (!data.netWeight || !data.netWeight.trim()) {
      data.netWeight = '500g';
    }

    if (typeof data.seoTitle === 'string') {
      data.seoTitle = data.seoTitle.trim();
    }
    if (typeof data.seoDescription === 'string') {
      data.seoDescription = data.seoDescription.trim();
    }
    if (typeof data.seoKeywords === 'string') {
      data.seoKeywords = data.seoKeywords.split(',').map((k) => k.trim()).filter(Boolean);
    } else if (Array.isArray(data.seoKeywords)) {
      data.seoKeywords = data.seoKeywords.map((k) => String(k).trim()).filter(Boolean);
    }

    if (typeof data.isBestseller !== 'undefined') {
      data.isBestseller = data.isBestseller === true || data.isBestseller === 'true';
    }
    if (typeof data.isRecommended !== 'undefined') {
      data.isRecommended = data.isRecommended === true || data.isRecommended === 'true';
    }

    const product = await createProductFirestore(data);
    res.status(201).json({ success: true, product });
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * PUT /api/products/:id
 * Admin: update a product
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (Array.isArray(updates.images)) {
      updates.images = updates.images.map((s) => String(s).trim()).filter(Boolean);
      if (!updates.image && updates.images.length > 0) {
        updates.image = updates.images[0];
      }
    }
    if (typeof updates.videoURLs === 'string') {
      updates.videoURLs = updates.videoURLs.trim() ? [updates.videoURLs.trim()] : [];
    } else if (Array.isArray(updates.videoURLs)) {
      updates.videoURLs = updates.videoURLs.map((s) => String(s).trim()).filter(Boolean);
    }

    if (updates.category) {
      const catObj = await getCategoryBySlug(updates.category);
      updates.categoryLabel = catObj ? catObj.name : updates.category.charAt(0).toUpperCase() + updates.category.slice(1);
    }
    if (typeof updates.price !== 'undefined' && updates.price !== '') {
      updates.price = Number(updates.price);
    }
    if (typeof updates.originalPrice !== 'undefined' && updates.originalPrice !== '') {
      updates.originalPrice = Number(updates.originalPrice);
    }

    if (typeof updates.seoTitle === 'string') {
      updates.seoTitle = updates.seoTitle.trim();
    }
    if (typeof updates.seoDescription === 'string') {
      updates.seoDescription = updates.seoDescription.trim();
    }
    if (typeof updates.seoKeywords === 'string') {
      updates.seoKeywords = updates.seoKeywords.split(',').map((k) => k.trim()).filter(Boolean);
    } else if (Array.isArray(updates.seoKeywords)) {
      updates.seoKeywords = updates.seoKeywords.map((k) => String(k).trim()).filter(Boolean);
    }

    if (typeof updates.isBestseller !== 'undefined') {
      updates.isBestseller = updates.isBestseller === true || updates.isBestseller === 'true';
    }
    if (typeof updates.isRecommended !== 'undefined') {
      updates.isRecommended = updates.isRecommended === true || updates.isRecommended === 'true';
    }

    const product = await updateProductFirestore(id, updates);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.status(200).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/products/:id
 * Admin: delete a product
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteProductFirestore(id);
    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};

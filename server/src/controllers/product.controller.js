const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');

/**
 * GET /api/categories
 * Retrieve all active categories
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 });
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

    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(400).json({ success: false, message: `Category with slug "${slug}" already exists` });
    }

    const category = await Category.create({
      name: name.trim(),
      slug,
      tagline: tagline || '',
      icon: icon || '🥩',
      image: image || '',
      order: typeof order === 'number' ? order : 0,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
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
    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ slug: id }, { _id: id }] }
      : { slug: id };

    const category = await Category.findOneAndUpdate(
      filter,
      req.body,
      { new: true, runValidators: true }
    );
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
    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ slug: id }, { _id: id }] }
      : { slug: id };

    const category = await Category.findOneAndDelete(filter);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
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

    const query = {};
    
    if (all !== 'true') {
      query.inStock = true;
    }

    if (category && category !== 'all') {
      query.category = category.toLowerCase();
    }

    if (bestseller === 'true') {
      query.isBestseller = true;
    }

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { hindiName: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    let sortOption = {};
    if (sort === 'price-asc' || sort === 'price_asc') {
      sortOption = { price: 1 };
    } else if (sort === 'price-desc' || sort === 'price_desc') {
      sortOption = { price: -1 };
    } else if (sort === 'name-asc' || sort === 'name_asc') {
      sortOption = { name: 1 };
    } else if (sort === 'name-desc' || sort === 'name_desc') {
      sortOption = { name: -1 };
    } else if (sort === 'rating') {
      sortOption = { rating: -1 };
    } else {
      sortOption = { isBestseller: -1, createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.status(200).json({
      success: true,
      count: products.length,
      total,
      products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/products/:id
 * Retrieve product by ID or slug with related products
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({
      $or: [{ id: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Get up to 4 related products in same category
    const related = await Product.find({
      category: product.category,
      id: { $ne: product.id },
    }).limit(4);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.status(200).json({
      success: true,
      product,
      related,
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
      data.images = data.images.map(s => String(s).trim()).filter(Boolean);
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
      data.videoURLs = data.videoURLs.map(s => String(s).trim()).filter(Boolean);
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
      const catObj = await Category.findOne({ slug: data.category });
      data.categoryLabel = catObj ? catObj.name : data.category.charAt(0).toUpperCase() + data.category.slice(1);
    }
    if (!data.netWeight || !data.netWeight.trim()) {
      data.netWeight = '500g';
    }

    const product = await Product.create(data);
    res.status(201).json({ success: true, product });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A product with this ID or name already exists' });
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
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const updates = { ...req.body };

    if (Array.isArray(updates.images)) {
      updates.images = updates.images.map(s => String(s).trim()).filter(Boolean);
      if (!updates.image && updates.images.length > 0) {
        updates.image = updates.images[0];
      }
    }
    if (typeof updates.videoURLs === 'string') {
      updates.videoURLs = updates.videoURLs.trim() ? [updates.videoURLs.trim()] : [];
    } else if (Array.isArray(updates.videoURLs)) {
      updates.videoURLs = updates.videoURLs.map(s => String(s).trim()).filter(Boolean);
    }

    if (updates.category) {
      const catObj = await Category.findOne({ slug: updates.category });
      updates.categoryLabel = catObj ? catObj.name : updates.category.charAt(0).toUpperCase() + updates.category.slice(1);
    }
    if (typeof updates.price !== 'undefined' && updates.price !== '') {
      updates.price = Number(updates.price);
    }
    if (typeof updates.originalPrice !== 'undefined' && updates.originalPrice !== '') {
      updates.originalPrice = Number(updates.originalPrice);
    }

    const product = await Product.findOneAndUpdate(
      { $or: [{ id }, ...(isMongoId ? [{ _id: id }] : [])] },
      { $set: updates },
      { new: true, runValidators: true }
    );
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
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const product = await Product.findOneAndDelete({
      $or: [{ id }, ...(isMongoId ? [{ _id: id }] : [])],
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, message: 'Product deleted' });
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

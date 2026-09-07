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
    const category = await Category.create(req.body);
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
    const category = await Category.findOneAndUpdate(
      { $or: [{ slug: id }, { _id: id }] },
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
    const category = await Category.findOneAndDelete({ $or: [{ slug: id }, { _id: id }] });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({ success: true, message: 'Category deleted' });
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
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch (error) {
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
    const product = await Product.findOneAndUpdate(
      { $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
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
    const product = await Product.findOneAndDelete({
      $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
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

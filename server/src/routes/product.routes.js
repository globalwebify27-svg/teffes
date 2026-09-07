const { Router } = require('express');
const { protect, authorize } = require('../middlewares/auth');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/product.controller');

const router = Router();

// Public routes
router.get('/categories', getCategories);
router.get('/products', getProducts);
router.get('/products/:id', getProductById);

// Protected routes (Super Admin & Store Admin)
router.post('/categories', protect, authorize('superadmin', 'admin'), createCategory);
router.put('/categories/:id', protect, authorize('superadmin', 'admin'), updateCategory);
router.delete('/categories/:id', protect, authorize('superadmin', 'admin'), deleteCategory);

router.post('/products', protect, authorize('superadmin', 'storeadmin', 'admin'), createProduct);
router.put('/products/:id', protect, authorize('superadmin', 'storeadmin', 'admin'), updateProduct);
router.delete('/products/:id', protect, authorize('superadmin', 'storeadmin', 'admin'), deleteProduct);

module.exports = router;

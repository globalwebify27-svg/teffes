const { Router } = require('express');
const { protect } = require('../middlewares/auth');
const {
  getCart,
  updateCart,
  clearCart,
  getWishlist,
  updateWishlist,
  toggleWishlist,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
} = require('../controllers/user.controller');

const router = Router();

// All user routes require authentication
router.use(protect);

// Cart routes
router.get('/cart', getCart);
router.put('/cart', updateCart);
router.delete('/cart', clearCart);

// Wishlist routes
router.get('/wishlist', getWishlist);
router.put('/wishlist', updateWishlist);
router.post('/wishlist/toggle', toggleWishlist);

// Address routes
router.get('/addresses', getAddresses);
router.post('/addresses', addAddress);
router.put('/addresses/:id', updateAddress);
router.delete('/addresses/:id', deleteAddress);

module.exports = router;

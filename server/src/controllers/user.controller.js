const User = require('../models/User');

/**
 * GET /api/user/cart
 * Retrieve user's persistent cart from MongoDB Atlas
 */
const getCart = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('cart');
    res.status(200).json({
      success: true,
      cart: user?.cart || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/user/cart
 * Update or sync entire cart for authenticated user
 * Body: { items: CartItem[] }
 */
const updateCart = async (req, res, next) => {
  try {
    const rawItems = req.body.items || req.body.cart;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (Array.isArray(rawItems)) {
      user.cart = rawItems.map((item) => {
        const prod = typeof item.product === 'string' ? { id: item.product, name: item.name || item.product } : (item.product || {});
        return {
          product: prod,
          quantity: Number(item.quantity) || 1,
          selectedWeight: item.selectedWeight || '500g',
        };
      });
    } else {
      user.cart = [];
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cart updated successfully',
      cart: user.cart,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/user/cart
 * Clear user's cart upon checkout or manual clear
 */
const clearCart = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.cart = [];
      await user.save();
    }
    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      cart: [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user/wishlist
 * Retrieve user's wishlist IDs
 */
const getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('wishlist');
    res.status(200).json({
      success: true,
      wishlist: user?.wishlist || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/user/wishlist
 * Update / sync wishlist IDs
 * Body: { wishlistIds: string[] }
 */
const updateWishlist = async (req, res, next) => {
  try {
    const { wishlistIds } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.wishlist = Array.isArray(wishlistIds) ? wishlistIds : [];
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Wishlist synced successfully',
      wishlist: user.wishlist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/user/wishlist/toggle
 * Toggle product in user's wishlist
 * Body: { productId: string }
 */
const toggleWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const idx = user.wishlist.indexOf(productId);
    if (idx > -1) {
      user.wishlist.splice(idx, 1);
    } else {
      user.wishlist.push(productId);
    }

    await user.save();

    res.status(200).json({
      success: true,
      isInWishlist: idx === -1,
      wishlist: user.wishlist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user/addresses
 */
const getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');
    res.status(200).json({ success: true, addresses: user?.addresses || [] });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/user/addresses
 */
const addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    // If this is the first address or marked as default, unset other defaults
    if (req.body.isDefault || user.addresses.length === 0) {
      req.body.isDefault = true;
      user.addresses.forEach(a => (a.isDefault = false));
    }
    
    user.addresses.push(req.body);
    await user.save();
    res.status(201).json({ success: true, addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/user/addresses/:id
 */
const updateAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const address = user.addresses.id(req.params.id);
    if (!address) return res.status(404).json({ success: false, message: 'Address not found' });
    
    if (req.body.isDefault) {
      user.addresses.forEach(a => (a.isDefault = false));
    }
    
    address.set(req.body);
    await user.save();
    res.status(200).json({ success: true, addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/user/addresses/:id
 */
const deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    user.addresses.pull(req.params.id);
    
    // If the default address was deleted, make the first one default
    if (user.addresses.length > 0 && !user.addresses.some(a => a.isDefault)) {
      user.addresses[0].isDefault = true;
    }
    
    await user.save();
    res.status(200).json({ success: true, addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};

const { getDoc, updateDoc } = require('../lib/firestore');
const { getUserById } = require('../services/firestore/user.firestore.service');

/**
 * GET /api/user/cart
 * Retrieve user's persistent cart from Cloud Firestore
 */
const getCart = async (req, res, next) => {
  try {
    const userId = String(req.user?.id || req.user?._id);
    const user = await getUserById(userId);
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
    const userId = String(req.user?.id || req.user?._id);
    const rawItems = req.body.items || req.body.cart;
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let updatedCart = [];
    if (Array.isArray(rawItems)) {
      updatedCart = rawItems.map((item) => {
        const prod = typeof item.product === 'string' ? { id: item.product, name: item.name || item.product } : (item.product || {});
        return {
          product: prod,
          quantity: Number(item.quantity) || 1,
          selectedWeight: item.selectedWeight || '500g',
        };
      });
    }

    await updateDoc('users', userId, {
      cart: updatedCart,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Cart updated successfully',
      cart: updatedCart,
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
    const userId = String(req.user?.id || req.user?._id);
    await updateDoc('users', userId, {
      cart: [],
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

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
    const userId = String(req.user?.id || req.user?._id);
    const user = await getUserById(userId);
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
    const userId = String(req.user?.id || req.user?._id);
    const { wishlistIds } = req.body;
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updatedWishlist = Array.isArray(wishlistIds) ? wishlistIds : [];
    await updateDoc('users', userId, {
      wishlist: updatedWishlist,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Wishlist synced successfully',
      wishlist: updatedWishlist,
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
    const userId = String(req.user?.id || req.user?._id);
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const wishlist = Array.isArray(user.wishlist) ? [...user.wishlist] : [];
    const idx = wishlist.indexOf(productId);
    if (idx > -1) {
      wishlist.splice(idx, 1);
    } else {
      wishlist.push(productId);
    }

    await updateDoc('users', userId, {
      wishlist,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      isInWishlist: idx === -1,
      wishlist,
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
    const userId = String(req.user?.id || req.user?._id);
    const user = await getUserById(userId);
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
    const userId = String(req.user?.id || req.user?._id);
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const addresses = Array.isArray(user.addresses) ? [...user.addresses] : [];
    const newAddressId = `addr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newAddress = {
      id: newAddressId,
      _id: newAddressId,
      ...req.body,
    };

    if (newAddress.isDefault || addresses.length === 0) {
      newAddress.isDefault = true;
      addresses.forEach((a) => (a.isDefault = false));
    }

    addresses.push(newAddress);
    await updateDoc('users', userId, {
      addresses,
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({ success: true, addresses });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/user/addresses/:id
 */
const updateAddress = async (req, res, next) => {
  try {
    const userId = String(req.user?.id || req.user?._id);
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const addresses = Array.isArray(user.addresses) ? [...user.addresses] : [];
    const targetIdx = addresses.findIndex((a) => String(a.id || a._id) === String(req.params.id));
    if (targetIdx === -1) return res.status(404).json({ success: false, message: 'Address not found' });

    if (req.body.isDefault) {
      addresses.forEach((a) => (a.isDefault = false));
    }

    addresses[targetIdx] = {
      ...addresses[targetIdx],
      ...req.body,
      id: addresses[targetIdx].id || addresses[targetIdx]._id,
      _id: addresses[targetIdx]._id || addresses[targetIdx].id,
    };

    await updateDoc('users', userId, {
      addresses,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({ success: true, addresses });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/user/addresses/:id
 */
const deleteAddress = async (req, res, next) => {
  try {
    const userId = String(req.user?.id || req.user?._id);
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let addresses = Array.isArray(user.addresses) ? [...user.addresses] : [];
    addresses = addresses.filter((a) => String(a.id || a._id) !== String(req.params.id));

    if (addresses.length > 0 && !addresses.some((a) => a.isDefault)) {
      addresses[0].isDefault = true;
    }

    await updateDoc('users', userId, {
      addresses,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({ success: true, addresses });
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

/**
 * Staging Auth & User Profile Controller (Firestore-backed)
 * Provides 100% Firestore-driven authentication and profile management.
 */

const bcrypt = require('bcryptjs');
const {
  findOrCreateFirebaseCustomer,
  getUserById,
  getUserByEmail,
  updateUserProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getCart,
  updateCart,
  clearCart,
  getWishlist,
  toggleWishlist,
} = require('../../services/firestore/user.firestore.service');
const { signAccessToken } = require('../../utils/jwt');
const { getAuthInstance } = require('../../config/firebase');

/**
 * POST /api/staging/auth/firebase-login
 * Body: { token, idToken, name, email, phone }
 */
const firebaseLogin = async (req, res, next) => {
  try {
    const token = req.body.token || req.body.idToken;
    const { name, email, phone: bodyPhone } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Firebase token is required' });
    }

    const auth = getAuthInstance();
    const decodedToken = await auth.verifyIdToken(token);
    const phone = decodedToken.phone_number || bodyPhone || '';

    const user = await findOrCreateFirebaseCustomer({
      firebaseUid: decodedToken.uid,
      phone,
      name: name || decodedToken.name,
      email: email || decodedToken.email,
    });

    const accessToken = signAccessToken({ id: user._id || user.id, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      token: accessToken,
      user: {
        id: user._id || user.id,
        _id: user._id || user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified !== false,
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/staging/auth/admin-login
 * Body: { email, password }
 */
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    if (!user.password) {
      return res.status(401).json({ success: false, message: 'No password credential set for this account' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const accessToken = signAccessToken({ id: user._id || user.id, role: user.role });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      token: accessToken,
      user: {
        id: user._id || user.id,
        _id: user._id || user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        storeId: user.storeId || null,
        storeName: user.storeName || null,
        isVerified: user.isVerified !== false,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/staging/auth/me
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};

/**
 * PUT /api/staging/auth/me
 */
const updateMe = async (req, res) => {
  try {
    const updated = await updateUserProfile(req.user._id || req.user.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updated,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Address Handlers
 */
const getUserAddresses = async (req, res) => {
  try {
    const addresses = await getAddresses(req.user._id || req.user.id);
    return res.status(200).json({ success: true, count: addresses.length, addresses });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const createUserAddress = async (req, res) => {
  try {
    const addresses = await addAddress(req.user._id || req.user.id, req.body);
    const address = Array.isArray(addresses) && addresses.length > 0 ? addresses[addresses.length - 1] : null;
    return res.status(201).json({ success: true, message: 'Address added', address, addresses });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const updateUserAddress = async (req, res) => {
  try {
    const addresses = await updateAddress(req.user._id || req.user.id, req.params.addressId, req.body);
    return res.status(200).json({ success: true, message: 'Address updated', addresses });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const deleteUserAddress = async (req, res) => {
  try {
    const addresses = await deleteAddress(req.user._id || req.user.id, req.params.addressId);
    return res.status(200).json({ success: true, message: 'Address removed', addresses });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Cart Handlers
 */
const getUserCart = async (req, res) => {
  try {
    const cart = await getCart(req.user._id || req.user.id);
    return res.status(200).json({ success: true, cart: { items: cart }, items: cart });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const setUserCart = async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body)
      ? req.body
      : (req.body.items || req.body.cart?.items || req.body.cart || []);
    const cart = await updateCart(req.user._id || req.user.id, rawItems);
    return res.status(200).json({ success: true, message: 'Cart updated', cart: { items: cart }, items: cart });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const emptyUserCart = async (req, res) => {
  try {
    const cart = await clearCart(req.user._id || req.user.id);
    return res.status(200).json({ success: true, message: 'Cart cleared', cart });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Wishlist Handlers
 */
const getUserWishlist = async (req, res) => {
  try {
    const wishlist = await getWishlist(req.user._id || req.user.id);
    return res.status(200).json({ success: true, count: wishlist.length, wishlist });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const toggleUserWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const wishlist = await toggleWishlist(req.user._id || req.user.id, productId);
    return res.status(200).json({ success: true, wishlist });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  firebaseLogin,
  adminLogin,
  getMe,
  updateMe,
  getUserAddresses,
  createUserAddress,
  updateUserAddress,
  deleteUserAddress,
  getUserCart,
  setUserCart,
  emptyUserCart,
  getUserWishlist,
  toggleUserWishlist,
};

const {
  getDb,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  runTransaction,
} = require('../../lib/firestore');
const { getAuthInstance } = require('../../config/firebase');

const COLLECTION = 'users';

const ALLOWED_ROLES = ['customer', 'rider', 'storeadmin', 'superadmin'];

/**
 * Clean phone number to 10-digit format for consistent queries.
 * E.g. "+919876543210" -> "9876543210"
 */
const normalizePhone = (rawPhone) => {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  let clean = rawPhone.replace(/\D/g, '');
  if (clean.length > 10 && clean.startsWith('91')) {
    clean = clean.substring(2);
  }
  return clean;
};

/**
 * Retrieve user by document ID.
 */
const getUserById = async (userId) => {
  if (!userId || typeof userId !== 'string') return null;
  return getDoc(COLLECTION, userId.trim());
};

/**
 * Retrieve user by Firebase UID.
 */
const getUserByFirebaseUid = async (firebaseUid) => {
  if (!firebaseUid || typeof firebaseUid !== 'string') return null;
  const cleanUid = firebaseUid.trim();
  const direct = await getDoc(COLLECTION, cleanUid);
  if (direct) return direct;
  const users = await queryDocs(COLLECTION, (ref) => ref.where('firebaseUid', '==', cleanUid).limit(1));
  return users[0] || null;
};

/**
 * Retrieve user by email address.
 */
const getUserByEmail = async (email) => {
  if (!email || typeof email !== 'string') return null;
  const clean = email.trim().toLowerCase();
  const users = await queryDocs(COLLECTION, (ref) => ref.where('email', '==', clean).limit(1));
  return users[0] || null;
};

/**
 * Retrieve user by phone number.
 */
const getUserByPhone = async (phone) => {
  const clean = normalizePhone(phone);
  if (!clean) return null;
  const users = await queryDocs(COLLECTION, (ref) => ref.where('phone', '==', clean).limit(1));
  return users[0] || null;
};

/**
 * Atomically authenticate or register a customer via Firebase UID & Phone.
 *
 * Security & Integrity Guarantees:
 * - Runs in a Firestore transaction to prevent duplicate profiles during concurrent logins.
 * - Always enforces role 'customer' (prevents self-assignment of privileged roles).
 * - Locks financial fields (walletBalance begins at 0 and cannot be manipulated here).
 * - Preserves existing addresses, cart, and wishlist across logins.
 */
const findOrCreateFirebaseCustomer = async ({
  firebaseUid,
  phone,
  name = 'Valued Customer',
  email = '',
}) => {
  if (!firebaseUid || typeof firebaseUid !== 'string' || !firebaseUid.trim()) {
    throw new Error('Valid firebaseUid is required');
  }

  const cleanUid = firebaseUid.trim();
  const cleanPhone = normalizePhone(phone);
  const now = new Date().toISOString();
  const db = getDb();

  return runTransaction(async (transaction) => {
    const userRef = db.collection(COLLECTION).doc(cleanUid);
    const userSnap = await transaction.get(userRef);

    if (userSnap.exists) {
      const existingData = userSnap.data();

      if (existingData.isActive === false) {
        throw new Error('Account is deactivated. Contact customer support.');
      }

      // Update last login timestamp and optional name/email if not previously set
      const updates = {
        lastLoginAt: now,
        updatedAt: now,
      };
      if (name && (!existingData.name || existingData.name === 'Valued Customer')) {
        updates.name = name.trim();
      }
      if (email && !existingData.email) {
        updates.email = email.trim().toLowerCase();
      }

      transaction.update(userRef, updates);

      return {
        _id: cleanUid,
        id: cleanUid,
        ...existingData,
        ...updates,
        isNewUser: false,
      };
    }

    // Check if user exists under phone number to link accounts safely
    let existingByPhoneDoc = null;
    if (cleanPhone) {
      const phoneQuery = await db.collection(COLLECTION).where('phone', '==', cleanPhone).limit(1).get();
      if (!phoneQuery.empty) {
        existingByPhoneDoc = phoneQuery.docs[0];
      }
    }

    if (existingByPhoneDoc) {
      const existingData = existingByPhoneDoc.data();
      if (existingData.isActive === false) {
        throw new Error('Account is deactivated. Contact customer support.');
      }

      // Link firebaseUid to existing user record
      const updates = {
        firebaseUid: cleanUid,
        isVerified: true,
        lastLoginAt: now,
        updatedAt: now,
      };
      transaction.update(existingByPhoneDoc.ref, updates);

      return {
        _id: existingByPhoneDoc.id,
        id: existingByPhoneDoc.id,
        ...existingData,
        ...updates,
        isNewUser: false,
      };
    }

    // Create fresh customer document
    const newCustomer = {
      firebaseUid: cleanUid,
      phone: cleanPhone,
      name: (name || 'Valued Customer').trim(),
      email: (email || '').trim().toLowerCase(),
      role: 'customer', // strictly forced to customer
      isActive: true,
      isVerified: true,
      walletBalance: 0.0,
      totalSpent: 0.0,
      loyaltyTier: 'Bronze',
      addresses: [],
      cart: [],
      wishlist: [],
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };

    transaction.set(userRef, newCustomer);

    return {
      _id: cleanUid,
      id: cleanUid,
      ...newCustomer,
      isNewUser: true,
    };
  });
};

/**
 * Create a privileged staff account (Rider, Store Admin, Super Admin).
 * Strictly requires authorized caller role checks before execution.
 */
const createPrivilegedUser = async (data = {}, actor = null) => {
  if (!actor || actor.role !== 'superadmin') {
    throw new Error('Unauthorized: Only Super Admins can provision privileged accounts');
  }

  const role = (data.role || '').trim().toLowerCase();
  if (!['rider', 'storeadmin', 'superadmin'].includes(role)) {
    throw new Error(`Invalid privileged role: ${role}`);
  }

  const userId = (data.id || data.userId || `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`).trim();
  const cleanPhone = normalizePhone(data.phone);

  const existing = await getDoc(COLLECTION, userId);
  if (existing) {
    throw new Error(`User with ID "${userId}" already exists`);
  }

  const now = new Date().toISOString();
  const payload = {
    name: (data.name || '').trim(),
    email: (data.email || '').trim().toLowerCase(),
    phone: cleanPhone,
    role,
    isActive: true,
    isVerified: true,
    storeId: data.storeId ? String(data.storeId).trim() : null,
    storeName: data.storeName ? String(data.storeName).trim() : null,
    vehicleNumber: (data.vehicleNumber || 'JH-01-BK-4920').trim(),
    vehicleType: (data.vehicleType || 'Bike').trim(),
    riderRating: Number(data.riderRating) || 5.0,
    riderRatingCount: Number(data.riderRatingCount) || 0,
    riderStatus: ['Available', 'On Delivery', 'Offline'].includes(data.riderStatus)
      ? data.riderStatus
      : 'Available',
    dailyTarget: Number(data.dailyTarget) || 16,
    cashInHand: 0.0,
    walletBalance: 0.0,
    totalSpent: 0.0,
    loyaltyTier: 'Bronze',
    addresses: [],
    cart: [],
    wishlist: [],
    createdAt: now,
    updatedAt: now,
  };

  return createDoc(COLLECTION, userId, payload, { overwrite: false });
};

/**
 * Safely update user profile properties.
 *
 * Security:
 * - Completely filters out and ignores sensitive fields (role, walletBalance, isVerified, etc.).
 * - Verifies caller owns the profile or is superadmin.
 */
const updateUserProfile = async (userId, updates = {}, requestingUser = null) => {
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required');
  }

  const cleanUserId = userId.trim();
  const existing = await getDoc(COLLECTION, cleanUserId);
  if (!existing) {
    throw new Error(`User "${cleanUserId}" not found`);
  }

  if (requestingUser) {
    const isOwner = requestingUser.id === cleanUserId || requestingUser._id === cleanUserId;
    const isSuperAdmin = requestingUser.role === 'superadmin';
    if (!isOwner && !isSuperAdmin) {
      throw new Error('Forbidden: You cannot modify another user profile');
    }
  }

  // Security: only allow safe profile fields to be updated
  const safePayload = {};
  if (updates.name !== undefined) safePayload.name = String(updates.name).trim();
  if (updates.email !== undefined) safePayload.email = String(updates.email).trim().toLowerCase();
  if (updates.avatar !== undefined) safePayload.avatar = String(updates.avatar).trim();

  // Rider-specific safe operational fields
  if (existing.role === 'rider') {
    if (updates.riderStatus && ['Available', 'On Delivery', 'Offline'].includes(updates.riderStatus)) {
      safePayload.riderStatus = updates.riderStatus;
    }
    if (updates.vehicleNumber !== undefined) safePayload.vehicleNumber = String(updates.vehicleNumber).trim();
  }

  return updateDoc(COLLECTION, cleanUserId, safePayload);
};

// ==========================================
// Address Management (Customer)
// ==========================================

const getAddresses = async (userId) => {
  const user = await getUserById(userId);
  return user?.addresses || [];
};

const addAddress = async (userId, addressData = {}) => {
  const user = await getUserById(userId);
  if (!user) throw new Error(`User "${userId}" not found`);

  const addresses = Array.isArray(user.addresses) ? [...user.addresses] : [];
  const addressId = `addr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const isDefault = Boolean(addressData.isDefault) || addresses.length === 0;

  if (isDefault) {
    addresses.forEach((a) => (a.isDefault = false));
  }

  const newAddress = {
    id: addressId,
    tag: (addressData.tag || 'Home').trim(),
    line1: (addressData.line1 || '').trim(),
    line2: (addressData.line2 || '').trim(),
    city: (addressData.city || 'Ranchi').trim(),
    pincode: (addressData.pincode || '').trim(),
    landmark: (addressData.landmark || '').trim(),
    latitude: addressData.latitude ? Number(addressData.latitude) : null,
    longitude: addressData.longitude ? Number(addressData.longitude) : null,
    isDefault,
  };

  addresses.push(newAddress);
  await updateDoc(COLLECTION, userId, { addresses });
  return addresses;
};

const updateAddress = async (userId, addressId, addressData = {}) => {
  const user = await getUserById(userId);
  if (!user) throw new Error(`User "${userId}" not found`);

  const addresses = Array.isArray(user.addresses) ? [...user.addresses] : [];
  const targetIndex = addresses.findIndex((a) => a.id === addressId);
  if (targetIndex === -1) {
    throw new Error(`Address "${addressId}" not found`);
  }

  if (addressData.isDefault) {
    addresses.forEach((a) => (a.isDefault = false));
  }

  addresses[targetIndex] = {
    ...addresses[targetIndex],
    ...addressData,
    id: addressId, // prevent ID overwrite
  };

  await updateDoc(COLLECTION, userId, { addresses });
  return addresses;
};

const deleteAddress = async (userId, addressId) => {
  const user = await getUserById(userId);
  if (!user) throw new Error(`User "${userId}" not found`);

  let addresses = Array.isArray(user.addresses) ? [...user.addresses] : [];
  const wasDefault = addresses.find((a) => a.id === addressId)?.isDefault;
  addresses = addresses.filter((a) => a.id !== addressId);

  // If default was removed, promote first remaining address
  if (wasDefault && addresses.length > 0) {
    addresses[0].isDefault = true;
  }

  await updateDoc(COLLECTION, userId, { addresses });
  return addresses;
};

// ==========================================
// Cart & Wishlist Management (Customer)
// ==========================================

const getCart = async (userId) => {
  const user = await getUserById(userId);
  return user?.cart || [];
};

const updateCart = async (userId, cartItems = []) => {
  const user = await getUserById(userId);
  if (!user) throw new Error(`User "${userId}" not found`);

  const formattedCart = Array.isArray(cartItems)
    ? cartItems.map((item) => ({
        product: typeof item.product === 'string' ? { id: item.product } : item.product || {},
        quantity: Math.max(1, Number(item.quantity) || 1),
        selectedWeight: (item.selectedWeight || '500g').trim(),
      }))
    : [];

  await updateDoc(COLLECTION, userId, { cart: formattedCart });
  return formattedCart;
};

const clearCart = async (userId) => {
  const user = await getUserById(userId);
  if (!user) throw new Error(`User "${userId}" not found`);
  await updateDoc(COLLECTION, userId, { cart: [] });
  return [];
};

const getWishlist = async (userId) => {
  const user = await getUserById(userId);
  return user?.wishlist || [];
};

const toggleWishlist = async (userId, productId) => {
  if (!productId || typeof productId !== 'string') {
    throw new Error('Valid productId is required');
  }

  const user = await getUserById(userId);
  if (!user) throw new Error(`User "${userId}" not found`);

  const wishlist = Array.isArray(user.wishlist) ? [...user.wishlist] : [];
  const cleanProductId = productId.trim();
  const idx = wishlist.indexOf(cleanProductId);

  let isInWishlist = false;
  if (idx > -1) {
    wishlist.splice(idx, 1);
  } else {
    wishlist.push(cleanProductId);
    isInWishlist = true;
  }

  await updateDoc(COLLECTION, userId, { wishlist });
  return { isInWishlist, wishlist };
};

// ==========================================
// Authorization Helpers
// ==========================================

/**
 * Server-side role authorization checker.
 */
const checkUserAuthorization = (user, allowedRoles = []) => {
  if (!user) {
    return { authorized: false, reason: 'Unauthenticated' };
  }
  if (!user.isActive) {
    return { authorized: false, reason: 'Account is deactivated' };
  }
  if (!allowedRoles.includes(user.role)) {
    return { authorized: false, reason: `Role '${user.role}' is not authorized` };
  }
  return { authorized: true };
};

/**
 * Safely delete a user document (strictly for test cleanup).
 */
const deleteUser = async (userId) => {
  if (!userId || typeof userId !== 'string') return false;
  await deleteDoc(COLLECTION, userId.trim());
  return true;
};

module.exports = {
  COLLECTION,
  ALLOWED_ROLES,
  normalizePhone,
  getUserById,
  getUserByFirebaseUid,
  getUserByEmail,
  getUserByPhone,
  findOrCreateFirebaseCustomer,
  createPrivilegedUser,
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
  checkUserAuthorization,
  deleteUser,
};

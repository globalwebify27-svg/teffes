const {
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
} = require('../../lib/firestore');

const COLLECTION = 'banners';

const DEFAULT_BANNERS = [
  {
    title: 'Fresh Meat Delivered in 90 Minutes',
    image: '/banner-1.jpg',
    link: '/category/chicken',
    order: 1,
    isActive: true,
  },
  {
    title: 'Premium Tender Mutton',
    image: '/banner-2.jpg',
    link: '/category/mutton',
    order: 2,
    isActive: true,
  },
  {
    title: 'River Fresh Fish & Prawns',
    image: '/banner-3.jpg',
    link: '/category/fish',
    order: 3,
    isActive: true,
  },
];

/**
 * Retrieve active banners sorted by order.
 * If Firestore collection is empty, returns defaults for visual stability without mutating DB.
 */
const getActiveBanners = async () => {
  const banners = await queryDocs(COLLECTION, (ref) => ref.where('isActive', '==', true));
  if (banners.length === 0) {
    return DEFAULT_BANNERS.map((b, i) => ({ id: `default_${i + 1}`, _id: `default_${i + 1}`, ...b }));
  }
  return banners.sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * Retrieve all banners for admin panel.
 */
const getAllBanners = async () => {
  const banners = await queryDocs(COLLECTION);
  return banners.sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * Retrieve a banner by document ID.
 */
const getBannerById = async (id) => {
  if (!id || typeof id !== 'string') return null;
  return getDoc(COLLECTION, id.trim());
};

/**
 * Safely create a new banner.
 */
const createBanner = async (data = {}) => {
  if (!data.image || typeof data.image !== 'string' || !data.image.trim()) {
    throw new Error('Banner image URL is required');
  }

  const payload = {
    title: (data.title || '').trim(),
    image: data.image.trim(),
    link: (data.link || '').trim(),
    order: Number.isInteger(Number(data.order)) ? Number(data.order) : 0,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  };

  const explicitId = data.id && typeof data.id === 'string' ? data.id.trim() : null;
  return createDoc(COLLECTION, explicitId, payload, { overwrite: false });
};

/**
 * Safely update an existing banner.
 */
const updateBanner = async (id, updates = {}) => {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('Banner ID is required for update');
  }

  const existing = await getDoc(COLLECTION, id.trim());
  if (!existing) {
    throw new Error(`Banner with ID "${id}" not found`);
  }

  const payload = {};
  if (updates.title !== undefined) payload.title = String(updates.title).trim();
  if (updates.image !== undefined) payload.image = String(updates.image).trim();
  if (updates.link !== undefined) payload.link = String(updates.link).trim();
  if (updates.order !== undefined) payload.order = Number(updates.order) || 0;
  if (updates.isActive !== undefined) payload.isActive = Boolean(updates.isActive);

  return updateDoc(COLLECTION, id.trim(), payload);
};

/**
 * Safely delete a banner.
 */
const deleteBanner = async (id) => {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('Banner ID is required for deletion');
  }

  const existing = await getDoc(COLLECTION, id.trim());
  if (!existing) {
    throw new Error(`Banner with ID "${id}" not found`);
  }

  await deleteDoc(COLLECTION, id.trim());
  return true;
};

module.exports = {
  COLLECTION,
  DEFAULT_BANNERS,
  getActiveBanners,
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
};

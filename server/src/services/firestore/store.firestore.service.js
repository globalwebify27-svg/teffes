const {
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
} = require('../../lib/firestore');

const COLLECTION = 'stores';

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
const calculateHaversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Retrieve all stores for admin management.
 */
const getAllStores = async (options = {}) => {
  const stores = await queryDocs(COLLECTION);
  return stores
    .filter(
      (s) =>
        options.includeTest ||
        (!s.isTest &&
          !String(s.storeId || s.id || '').startsWith('E2E_') &&
          !String(s.storeId || s.id || '').startsWith('test_'))
    )
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

/**
 * Retrieve active and open stores.
 */
const getActiveStores = async (options = {}) => {
  const stores = await queryDocs(COLLECTION, (ref) => ref.where('status', '==', 'Active'));
  return stores
    .filter((s) => s.isOpen !== false)
    .filter(
      (s) =>
        options.includeTest ||
        (!s.isTest &&
          !String(s.storeId || s.id || '').startsWith('E2E_') &&
          !String(s.storeId || s.id || '').startsWith('test_'))
    );
};

/**
 * Retrieve a single store by storeId.
 */
const getStoreById = async (storeId) => {
  if (!storeId || typeof storeId !== 'string') return null;
  return getDoc(COLLECTION, storeId.trim());
};

/**
 * Find the nearest eligible store for given user GPS coordinates.
 */
const findNearestStore = async (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  if (isNaN(lat) || isNaN(lon)) return null;

  const activeStores = await getActiveStores();
  if (activeStores.length === 0) return null;

  let nearest = null;
  let minDistance = Infinity;

  for (const store of activeStores) {
    const coords = store.location?.coordinates || [85.3096, 23.3441];
    // MongoDB Store schema coordinates are [longitude, latitude]
    const storeLon = coords[0];
    const storeLat = coords[1];

    const dist = calculateHaversineDistanceKm(lat, lon, storeLat, storeLon);
    const radius = Number(store.deliveryRadiusKm) || 12;

    if (dist <= radius && dist < minDistance) {
      minDistance = dist;
      nearest = { ...store, distanceKm: Math.round(dist * 10) / 10 };
    }
  }

  return nearest;
};

/**
 * Safely create a new store.
 */
const createStore = async (data = {}) => {
  if (!data.storeId || typeof data.storeId !== 'string' || !data.storeId.trim()) {
    throw new Error('storeId is required');
  }
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('Store name is required');
  }

  const cleanStoreId = data.storeId.trim();
  const existing = await getDoc(COLLECTION, cleanStoreId);
  if (existing) {
    throw new Error(`Store with storeId "${cleanStoreId}" already exists`);
  }

  const payload = {
    storeId: cleanStoreId,
    name: data.name.trim(),
    city: (data.city || 'Ranchi').trim(),
    address: (data.address || '').trim(),
    image: (data.image || '').trim(),
    admin: (data.admin || '—').trim(),
    adminEmail: (data.adminEmail || '').trim(),
    phone: (data.phone || '').trim(),
    status: ['Active', 'Planned', 'Inactive'].includes(data.status) ? data.status : 'Active',
    orders: Number(data.orders) || 0,
    pickupEnabled: typeof data.pickupEnabled === 'boolean' ? data.pickupEnabled : true,
    deliveryEnabled: typeof data.deliveryEnabled === 'boolean' ? data.deliveryEnabled : true,
    timings: (data.timings || '08:00 AM - 08:00 PM').trim(),
    isOpen: typeof data.isOpen === 'boolean' ? data.isOpen : true,
    emergencyNotice: (data.emergencyNotice || '').trim(),
    riderPayoutSettings: {
      baseDeliveryPay: Number(data.riderPayoutSettings?.baseDeliveryPay) || 65,
      distanceIncentive: Number(data.riderPayoutSettings?.distanceIncentive) || 15,
      peakHourSurge: Number(data.riderPayoutSettings?.peakHourSurge) || 20,
    },
    freeDeliveryThreshold: Number(data.freeDeliveryThreshold) || 399,
    standardDeliveryFee: Number(data.standardDeliveryFee) || 40,
    expressDeliveryFee: Number(data.expressDeliveryFee) || 50,
    expressDeliveryEnabled: typeof data.expressDeliveryEnabled === 'boolean' ? data.expressDeliveryEnabled : true,
    rainSurgeEnabled: typeof data.rainSurgeEnabled === 'boolean' ? data.rainSurgeEnabled : false,
    rainSurgeFee: Number(data.rainSurgeFee) || 15,
    freeGiftThreshold: Number(data.freeGiftThreshold) || 499,
    freeGiftName: (data.freeGiftName || 'Free Biryani Rice (500g)').trim(),
    deliveryRadiusKm: Math.max(1, Number(data.deliveryRadiusKm) || 5),
    defaultRiderDailyTarget: Math.max(1, Number(data.defaultRiderDailyTarget) || 16),
    location: {
      type: 'Point',
      coordinates: Array.isArray(data.location?.coordinates) && data.location.coordinates.length === 2
        ? data.location.coordinates
        : [85.3096, 23.3441],
    },
  };

  return createDoc(COLLECTION, cleanStoreId, payload, { overwrite: false });
};

/**
 * Safely update an existing store.
 */
const updateStore = async (storeId, updates = {}) => {
  if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
    throw new Error('storeId is required for update');
  }

  const cleanStoreId = storeId.trim();
  const existing = await getDoc(COLLECTION, cleanStoreId);
  if (!existing) {
    throw new Error(`Store with storeId "${cleanStoreId}" not found`);
  }

  const payload = { ...updates };
  delete payload.storeId;
  delete payload.id;
  delete payload._id;

  return updateDoc(COLLECTION, cleanStoreId, payload);
};

/**
 * Safely delete a store.
 */
const deleteStore = async (storeId) => {
  if (!storeId || typeof storeId !== 'string' || !storeId.trim()) {
    throw new Error('storeId is required for deletion');
  }

  const cleanStoreId = storeId.trim();
  const existing = await getDoc(COLLECTION, cleanStoreId);
  if (!existing) {
    throw new Error(`Store with storeId "${cleanStoreId}" not found`);
  }

  await deleteDoc(COLLECTION, cleanStoreId);
  return true;
};

module.exports = {
  COLLECTION,
  calculateHaversineDistanceKm,
  getAllStores,
  getActiveStores,
  getStoreById,
  findNearestStore,
  createStore,
  updateStore,
  deleteStore,
};

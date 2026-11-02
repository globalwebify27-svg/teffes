/**
 * Promotional Pop-ups & Announcements Firestore Service
 * Cloud Firestore only. Zero MongoDB dependency.
 */

const { getDb } = require('../../lib/firestore');

const POPUPS_COLLECTION = 'promotional_popups';

/**
 * Normalizes a pop-up document from Firestore.
 */
function normalizePopup(doc) {
  if (!doc || !doc.exists) return null;
  const data = doc.data();
  return {
    id: doc.id,
    _id: doc.id,
    title: data.title || '',
    subtitle: data.subtitle || '',
    message: data.message || '',
    imageUrl: data.imageUrl || '',
    ctaText: data.ctaText || 'Shop Now',
    ctaLink: data.ctaLink || '/categories',
    couponCode: data.couponCode || '',
    targetAudience: data.targetAudience || 'ALL', // 'ALL' | 'GUEST' | 'LOGGED_IN' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    frequency: data.frequency || 'ONCE_PER_DAY', // 'ONCE_PER_DAY' | 'ONCE_PER_SESSION' | 'ALWAYS'
    priority: typeof data.priority === 'number' ? data.priority : 1,
    isActive: Boolean(data.isActive),
    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : new Date().toISOString(),
  };
}

/**
 * Fetch all pop-ups (Super Admin view, sorted by priority and createdAt)
 */
async function getAllPopups() {
  const db = getDb();
  const snapshot = await db.collection(POPUPS_COLLECTION).get();
  const popups = [];
  snapshot.forEach((doc) => {
    const p = normalizePopup(doc);
    if (p) popups.push(p);
  });

  // Sort descending by priority, then created date
  popups.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return popups;
}

/**
 * Fetch active pop-ups currently valid for customers
 * @param {Object} options - { userTier, isLoggedIn }
 */
async function getActivePopups(options = {}) {
  const { userTier = 'BRONZE', isLoggedIn = false } = options;
  const now = new Date();
  const db = getDb();

  const snapshot = await db.collection(POPUPS_COLLECTION).where('isActive', '==', true).get();
  const validPopups = [];

  snapshot.forEach((doc) => {
    const p = normalizePopup(doc);
    if (!p) return;

    // Check date range
    if (p.startDate) {
      const start = new Date(p.startDate);
      if (now < start) return;
    }
    if (p.endDate) {
      const end = new Date(p.endDate);
      if (now > end) return;
    }

    // Check audience targeting
    if (p.targetAudience === 'GUEST' && isLoggedIn) return;
    if (p.targetAudience === 'LOGGED_IN' && !isLoggedIn) return;

    // Tier specific targeting
    const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
    if (tierOrder.includes(p.targetAudience)) {
      if (!isLoggedIn) return;
      if (p.targetAudience !== userTier.toUpperCase()) return;
    }

    validPopups.push(p);
  });

  // Sort by highest priority
  validPopups.sort((a, b) => (b.priority || 1) - (a.priority || 1));

  return validPopups;
}

/**
 * Get single pop-up by ID
 */
async function getPopupById(id) {
  if (!id) return null;
  const db = getDb();
  const doc = await db.collection(POPUPS_COLLECTION).doc(id).get();
  return normalizePopup(doc);
}

/**
 * Create a new pop-up
 */
async function createPopup(data) {
  const db = getDb();
  const docRef = db.collection(POPUPS_COLLECTION).doc();
  const now = new Date().toISOString();

  const payload = {
    title: (data.title || '').trim(),
    subtitle: (data.subtitle || '').trim(),
    message: (data.message || '').trim(),
    imageUrl: (data.imageUrl || '').trim(),
    ctaText: (data.ctaText || 'Shop Now').trim(),
    ctaLink: (data.ctaLink || '/categories').trim(),
    couponCode: (data.couponCode || '').trim().toUpperCase(),
    targetAudience: data.targetAudience || 'ALL',
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    frequency: data.frequency || 'ONCE_PER_DAY',
    priority: typeof data.priority === 'number' ? data.priority : 1,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(payload);
  const created = await docRef.get();
  return normalizePopup(created);
}

/**
 * Update an existing pop-up
 */
async function updatePopup(id, updates) {
  if (!id) throw new Error('Popup ID is required');
  const db = getDb();
  const docRef = db.collection(POPUPS_COLLECTION).doc(id);
  const existing = await docRef.get();
  if (!existing.exists) {
    throw new Error('Popup not found');
  }

  const payload = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.title !== undefined) payload.title = String(updates.title).trim();
  if (updates.subtitle !== undefined) payload.subtitle = String(updates.subtitle).trim();
  if (updates.message !== undefined) payload.message = String(updates.message).trim();
  if (updates.imageUrl !== undefined) payload.imageUrl = String(updates.imageUrl).trim();
  if (updates.ctaText !== undefined) payload.ctaText = String(updates.ctaText).trim();
  if (updates.ctaLink !== undefined) payload.ctaLink = String(updates.ctaLink).trim();
  if (updates.couponCode !== undefined) payload.couponCode = String(updates.couponCode).trim().toUpperCase();
  if (updates.targetAudience !== undefined) payload.targetAudience = updates.targetAudience;
  if (updates.startDate !== undefined) payload.startDate = updates.startDate;
  if (updates.endDate !== undefined) payload.endDate = updates.endDate;
  if (updates.frequency !== undefined) payload.frequency = updates.frequency;
  if (updates.priority !== undefined) payload.priority = Number(updates.priority) || 1;
  if (updates.isActive !== undefined) payload.isActive = Boolean(updates.isActive);

  await docRef.update(payload);
  const updated = await docRef.get();
  return normalizePopup(updated);
}

/**
 * Delete a pop-up
 */
async function deletePopup(id) {
  if (!id) throw new Error('Popup ID is required');
  const db = getDb();
  const docRef = db.collection(POPUPS_COLLECTION).doc(id);
  const existing = await docRef.get();
  if (!existing.exists) {
    throw new Error('Popup not found');
  }
  await docRef.delete();
  return { success: true, id };
}

module.exports = {
  getAllPopups,
  getActivePopups,
  getPopupById,
  createPopup,
  updatePopup,
  deletePopup,
};

const {
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
} = require('../../lib/firestore');

const COLLECTION = 'categories';

/**
 * Normalizes a category slug string.
 */
const normalizeSlug = (slug) => {
  if (!slug || typeof slug !== 'string') return '';
  return slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
};

/**
 * Retrieve active categories for public display, sorted by order ascending.
 */
const getActiveCategories = async (options = {}) => {
  const categories = await queryDocs(COLLECTION, (ref) => ref.where('isActive', '==', true));
  return categories
    .filter(
      (c) =>
        options.includeTest ||
        (!c.isTest &&
          !String(c.slug || '').startsWith('e2e_') &&
          !String(c.slug || '').startsWith('test_'))
    )
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * Retrieve all categories for admin management.
 */
const getAllCategories = async () => {
  const categories = await queryDocs(COLLECTION);
  return categories.sort((a, b) => (a.order || 0) - (b.order || 0));
};

/**
 * Retrieve a category by its unique slug/id.
 */
const getCategoryBySlug = async (slug) => {
  const cleanSlug = normalizeSlug(slug);
  if (!cleanSlug) return null;
  return getDoc(COLLECTION, cleanSlug);
};

/**
 * Safely create a new category in Firestore.
 * Ensures slug uniqueness without overwriting existing data.
 */
const createCategory = async (data = {}) => {
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('Category name is required');
  }

  const slug = normalizeSlug(data.slug || data.name);
  if (!slug) {
    throw new Error('Valid category slug is required');
  }

  const existing = await getDoc(COLLECTION, slug);
  if (existing) {
    throw new Error(`Category with slug "${slug}" already exists`);
  }

  const payload = {
    slug,
    name: data.name.trim(),
    tagline: (data.tagline || '').trim(),
    icon: (data.icon || '🥩').trim(),
    image: (data.image || '').trim(),
    order: Number.isInteger(Number(data.order)) ? Number(data.order) : 0,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  };

  return createDoc(COLLECTION, slug, payload, { overwrite: false });
};

/**
 * Safely update an existing category.
 */
const updateCategory = async (slugOrId, updates = {}) => {
  const cleanSlug = normalizeSlug(slugOrId);
  if (!cleanSlug) {
    throw new Error('Valid category slug or ID is required for update');
  }

  const existing = await getDoc(COLLECTION, cleanSlug);
  if (!existing) {
    throw new Error(`Category with slug "${cleanSlug}" not found`);
  }

  const payload = {};
  if (updates.name !== undefined) payload.name = String(updates.name).trim();
  if (updates.tagline !== undefined) payload.tagline = String(updates.tagline).trim();
  if (updates.icon !== undefined) payload.icon = String(updates.icon).trim();
  if (updates.image !== undefined) payload.image = String(updates.image).trim();
  if (updates.order !== undefined) payload.order = Number(updates.order) || 0;
  if (updates.isActive !== undefined) payload.isActive = Boolean(updates.isActive);

  return updateDoc(COLLECTION, cleanSlug, payload);
};

/**
 * Safely delete a category.
 */
const deleteCategory = async (slugOrId) => {
  const cleanSlug = normalizeSlug(slugOrId);
  if (!cleanSlug) {
    throw new Error('Valid category slug or ID is required for deletion');
  }

  const existing = await getDoc(COLLECTION, cleanSlug);
  if (!existing) {
    throw new Error(`Category with slug "${cleanSlug}" not found`);
  }

  await deleteDoc(COLLECTION, cleanSlug);
  return true;
};

module.exports = {
  COLLECTION,
  normalizeSlug,
  getActiveCategories,
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
};

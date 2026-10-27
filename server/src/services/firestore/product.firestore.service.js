const {
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  countDocs,
} = require('../../lib/firestore');

const COLLECTION = 'products';

/**
 * Generate normalized lowercase search tokens and prefixes for Firestore queries.
 * Supports English and Hindi (Devanagari) characters.
 */
const generateSearchKeywords = (product = {}) => {
  const text = [
    product.name || '',
    product.hindiName || '',
    product.category || '',
    product.categoryLabel || '',
    product.description || '',
  ]
    .join(' ')
    .toLowerCase();

  const words = text
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const tokens = new Set();
  for (const word of words) {
    tokens.add(word);
    // Generate prefixes for progressive typeahead matching
    for (let len = 2; len <= Math.min(word.length, 15); len++) {
      tokens.add(word.substring(0, len));
    }
  }

  // Firestore allows up to 20,000 array elements, capped at 120 for optimal index footprint
  return Array.from(tokens).slice(0, 120);
};

/**
 * Retrieve products with filtering, sorting, pagination, and search.
 */
const getProducts = async (options = {}) => {
  const {
    category,
    search,
    bestseller,
    sort,
    limit = 50,
    page = 1,
    all = false,
  } = options;

  let products = await queryDocs(COLLECTION);

  // 0. Test data isolation guard: Excludes automated test fixtures from live catalog
  if (!options.includeTest) {
    products = products.filter(
      (p) =>
        !p.isTest &&
        !String(p.id || '').startsWith('e2e_') &&
        !String(p.id || '').startsWith('test_') &&
        !String(p.id || '').startsWith('phase')
    );
  }

  // 1. Stock availability filter
  if (!all) {
    products = products.filter((p) => p.inStock === true);
  }

  // 2. Category filter
  if (category && category !== 'all') {
    const catLower = category.toLowerCase().trim();
    products = products.filter((p) => (p.category || '').toLowerCase() === catLower);
  }

  // 3. Bestseller filter
  if (bestseller === true || bestseller === 'true') {
    products = products.filter((p) => p.isBestseller === true);
  }

  // 4. Search matching (substring + token)
  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    products = products.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(term);
      const hindiMatch = (p.hindiName || '').toLowerCase().includes(term);
      const descMatch = (p.description || '').toLowerCase().includes(term);
      const catMatch = (p.category || '').toLowerCase().includes(term);
      const tokenMatch = Array.isArray(p._searchKeywords) && p._searchKeywords.includes(term);
      return nameMatch || hindiMatch || descMatch || catMatch || tokenMatch;
    });
  }

  const total = products.length;

  // 5. Sorting
  if (sort === 'price-asc' || sort === 'price_asc') {
    products.sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (sort === 'price-desc' || sort === 'price_desc') {
    products.sort((a, b) => (b.price || 0) - (a.price || 0));
  } else if (sort === 'name-asc' || sort === 'name_asc') {
    products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sort === 'name-desc' || sort === 'name_desc') {
    products.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  } else if (sort === 'rating') {
    products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else {
    // Default sort: bestsellers first, then newest
    products.sort((a, b) => {
      if (a.isBestseller === b.isBestseller) {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      return a.isBestseller ? -1 : 1;
    });
  }

  // 6. Pagination
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 50);
  const skip = (pageNum - 1) * limitNum;
  const paginated = products.slice(skip, skip + limitNum);

  return {
    products: paginated,
    count: paginated.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
};

/**
 * Retrieve a single product by ID with up to 4 related category items.
 */
const getProductById = async (id) => {
  if (!id || typeof id !== 'string') return null;
  const cleanId = id.trim();
  const product = await getDoc(COLLECTION, cleanId);

  if (!product) return null;

  // Fetch related products in the same category
  const allInCat = await queryDocs(COLLECTION, (ref) =>
    ref.where('category', '==', product.category).limit(5)
  );
  const related = allInCat.filter((p) => p.id !== product.id).slice(0, 4);

  return { product, related };
};

/**
 * Safely create a product with search tokens and ID validation.
 */
const createProduct = async (data = {}) => {
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('Product name is required');
  }
  if (!data.category || typeof data.category !== 'string' || !data.category.trim()) {
    throw new Error('Category is required');
  }
  if (data.price === undefined || isNaN(Number(data.price)) || Number(data.price) < 0) {
    throw new Error('Valid non-negative price is required');
  }
  if (!data.image || typeof data.image !== 'string' || !data.image.trim()) {
    throw new Error('Product image is required');
  }

  const cleanId = data.id && typeof data.id === 'string' && data.id.trim()
    ? data.id.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '')
    : data.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');

  if (!cleanId) {
    throw new Error('Valid product ID or name is required');
  }

  const existing = await getDoc(COLLECTION, cleanId);
  if (existing) {
    throw new Error(`Product with ID "${cleanId}" already exists`);
  }

  const payload = {
    id: cleanId,
    name: data.name.trim(),
    hindiName: (data.hindiName || '').trim(),
    category: data.category.trim().toLowerCase(),
    categoryLabel: (data.categoryLabel || 'Fresh Meat').trim(),
    description: (data.description || '').trim(),
    pieces: (data.pieces || '').trim(),
    serves: (data.serves || '').trim(),
    badge: (data.badge || '').trim(),
    isBestseller: Boolean(data.isBestseller),
    isRecommended: Boolean(data.isRecommended),
    image: data.image.trim(),
    images: Array.isArray(data.images) ? data.images : [data.image.trim()],
    videoURLs: Array.isArray(data.videoURLs) ? data.videoURLs : [],
    netWeight: (data.netWeight || '500g').trim(),
    grossWeight: (data.grossWeight || '').trim(),
    price: Number(data.price),
    originalPrice: Number(data.originalPrice) || 0,
    rating: Number(data.rating) || 4.8,
    ratingCount: Number(data.ratingCount) || 100,
    baseRating: Number(data.baseRating) || 4.8,
    baseRatingCount: Number(data.baseRatingCount) || 100,
    inStock: typeof data.inStock === 'boolean' ? data.inStock : true,
    cutType: (data.cutType || '').trim(),
    cookingTime: (data.cookingTime || '').trim(),
    benefits: Array.isArray(data.benefits) ? data.benefits : [],
    seoTitle: (data.seoTitle || '').trim(),
    seoDescription: (data.seoDescription || '').trim(),
    seoKeywords: Array.isArray(data.seoKeywords) ? data.seoKeywords : [],
  };

  payload._searchKeywords = generateSearchKeywords(payload);

  return createDoc(COLLECTION, cleanId, payload, { overwrite: false });
};

/**
 * Safely update an existing product and regenerate search keywords.
 */
const updateProduct = async (id, updates = {}) => {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('Product ID is required for update');
  }

  const cleanId = id.trim();
  const existing = await getDoc(COLLECTION, cleanId);
  if (!existing) {
    throw new Error(`Product with ID "${cleanId}" not found`);
  }

  const payload = { ...updates };
  delete payload.id;
  delete payload._id;

  if (payload.price !== undefined) {
    payload.price = Math.max(0, Number(payload.price) || 0);
  }
  if (payload.originalPrice !== undefined) {
    payload.originalPrice = Math.max(0, Number(payload.originalPrice) || 0);
  }
  if (payload.category !== undefined) {
    payload.category = String(payload.category).trim().toLowerCase();
  }

  // Regenerate search keywords if descriptive fields change
  const mergedForTokens = { ...existing, ...payload };
  payload._searchKeywords = generateSearchKeywords(mergedForTokens);

  return updateDoc(COLLECTION, cleanId, payload);
};

/**
 * Safely delete a product.
 */
const deleteProduct = async (id) => {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('Product ID is required for deletion');
  }

  const cleanId = id.trim();
  const existing = await getDoc(COLLECTION, cleanId);
  if (!existing) {
    throw new Error(`Product with ID "${cleanId}" not found`);
  }

  await deleteDoc(COLLECTION, cleanId);
  return true;
};

module.exports = {
  COLLECTION,
  generateSearchKeywords,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};

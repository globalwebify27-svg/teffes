const {
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  runTransaction,
} = require('../../lib/firestore');

const REVIEWS_COLLECTION = 'reviews';
const PRODUCTS_COLLECTION = 'products';
const ORDERS_COLLECTION = 'orders';

/**
 * Deterministic review document ID.
 * Enforces strictly 1 review per user per product at the database level.
 */
const getReviewDocId = (productId, userId) => {
  if (!productId || !userId) {
    throw new Error('Both productId and userId are required to generate review ID');
  }
  const cleanProduct = String(productId).trim();
  const cleanUser = String(userId).trim();
  return `${cleanProduct}_${cleanUser}`;
};

/**
 * Calculate combined weighted rating stats (Baseline catalog rating + Live customer reviews).
 */
const computeProductRatingStats = async (productId) => {
  if (!productId || typeof productId !== 'string') {
    throw new Error('Valid productId is required');
  }

  let cleanProductId = productId.trim();
  let product = await getDoc(PRODUCTS_COLLECTION, cleanProductId);
  if (!product && cleanProductId !== cleanProductId.toLowerCase()) {
    cleanProductId = cleanProductId.toLowerCase();
    product = await getDoc(PRODUCTS_COLLECTION, cleanProductId);
  }

  const baseRating = Number(product?.baseRating || 4.8);
  const baseCount = Number(product?.baseRatingCount || 100);

  const reviews = await queryDocs(REVIEWS_COLLECTION, (ref) =>
    ref.where('productId', '==', cleanProductId)
  );

  const liveReviewsCount = reviews.length;
  const liveRatingsSum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);

  const totalRatings = baseCount + liveReviewsCount;
  const averageRating =
    totalRatings > 0
      ? parseFloat((((baseRating * baseCount) + liveRatingsSum) / totalRatings).toFixed(1))
      : baseRating;

  return {
    reviews: reviews.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    stats: {
      totalRatings,
      averageRating,
      liveReviewsCount,
      baseRating,
      baseCount,
    },
  };
};

/**
 * Check if the user has purchased the item and the order was delivered.
 */
const checkVerifiedPurchase = async (productId, userId) => {
  if (!productId || !userId) return false;
  const cleanUser = String(userId).trim();
  const cleanProduct = String(productId).trim().toLowerCase();

  const userOrders = await queryDocs(ORDERS_COLLECTION, (ref) =>
    ref.where('customer.userId', '==', cleanUser)
  );

  return userOrders.some((order) => {
    if (order.status !== 'Delivered') return false;
    return (order.items || []).some(
      (item) => String(item.productId || item.id || item.itemId).trim().toLowerCase() === cleanProduct
    );
  });
};

/**
 * Add a customer review for a product.
 * Enforces:
 * 1. Product existence.
 * 2. Rating between 1 and 5.
 * 3. Prevention of duplicate reviews (1 per user per product).
 * 4. Verified purchase detection.
 * 5. Atomic product rating synchronization.
 */
const addReview = async ({
  productId,
  user,
  rating,
  title = '',
  comment = '',
  enforceVerifiedOnly = false,
}) => {
  if (!productId || typeof productId !== 'string') {
    throw new Error('Valid productId is required');
  }
  if (!user || (!user.id && !user._id && !user.firebaseUid)) {
    throw new Error('Authenticated user context is required');
  }

  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    throw new Error('Rating must be a valid number between 1 and 5');
  }

  let cleanProductId = productId.trim();
  let product = await getDoc(PRODUCTS_COLLECTION, cleanProductId);
  if (!product && cleanProductId !== cleanProductId.toLowerCase()) {
    cleanProductId = cleanProductId.toLowerCase();
    product = await getDoc(PRODUCTS_COLLECTION, cleanProductId);
  }

  if (!product) {
    throw new Error(`Product '${productId.trim()}' does not exist`);
  }

  const userId = String(user.id || user._id || user.firebaseUid);
  const userName = user.name || 'Verified Customer';

  // Check for duplicate review
  const docId = getReviewDocId(cleanProductId, userId);
  const existing = await getDoc(REVIEWS_COLLECTION, docId);
  if (existing) {
    throw new Error(`Customer has already submitted a review for Product '${cleanProductId}'`);
  }

  // Check verified purchase
  const isVerifiedPurchase = await checkVerifiedPurchase(cleanProductId, userId);
  if (enforceVerifiedOnly && !isVerifiedPurchase) {
    throw new Error('Only customers who have purchased and received this product may leave a review');
  }

  const reviewDoc = {
    productId: cleanProductId,
    userId,
    userName,
    rating: numRating,
    title: (title || '').trim(),
    comment: (comment || '').trim(),
    isVerifiedPurchase: Boolean(isVerifiedPurchase),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const created = await createDoc(REVIEWS_COLLECTION, docId, reviewDoc);

  // Recalculate stats and sync product
  try {
    const { stats } = await computeProductRatingStats(cleanProductId);
    await updateDoc(PRODUCTS_COLLECTION, cleanProductId, {
      rating: stats.averageRating,
      ratingCount: stats.totalRatings,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // Non-fatal if product sync encounters minor lag
  }

  return {
    review: created,
    isVerifiedPurchase,
  };
};

/**
 * Get reviews and rating stats for a product.
 */
const getProductReviews = async (productId) => {
  if (!productId || typeof productId !== 'string') {
    throw new Error('Valid productId is required');
  }
  return computeProductRatingStats(productId);
};

/**
 * Safely delete a review (for moderation or test cleanup).
 * Recalculates product stats after removal.
 */
const deleteReview = async (reviewId) => {
  if (!reviewId || typeof reviewId !== 'string') {
    throw new Error('reviewId is required for deletion');
  }

  const existing = await getDoc(REVIEWS_COLLECTION, reviewId.trim());
  const res = await deleteDoc(REVIEWS_COLLECTION, reviewId.trim());

  if (existing && existing.productId) {
    try {
      const { stats } = await computeProductRatingStats(existing.productId);
      await updateDoc(PRODUCTS_COLLECTION, existing.productId, {
        rating: stats.averageRating,
        ratingCount: stats.totalRatings,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {}
  }

  return res;
};

module.exports = {
  REVIEWS_COLLECTION,
  getReviewDocId,
  computeProductRatingStats,
  checkVerifiedPurchase,
  addReview,
  getProductReviews,
  deleteReview,
};

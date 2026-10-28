/**
 * Review Controller (Pure Cloud Firestore Backend)
 * 100% Zero MongoDB dependency - Fully migrated to Google Cloud Firestore
 */

const {
  getProductReviews: getProductReviewsFS,
  addReview: addReviewFS,
  computeProductRatingStats,
} = require('../services/firestore/review.firestore.service');

// Get reviews for a product
exports.getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { reviews, stats } = await getProductReviewsFS(productId);

    res.status(200).json({
      success: true,
      reviews,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

// Add a review
exports.addReview = async (req, res, next) => {
  try {
    const { productId, rating, title, comment } = req.body;
    const user = req.user;

    if (!productId || !rating) {
      return res.status(400).json({ success: false, message: 'Product ID and Rating are required' });
    }

    const { review, stats } = await addReviewFS({
      productId,
      rating,
      title,
      comment,
      user,
      enforceVerifiedOnly: false,
    });

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      review,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

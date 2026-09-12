const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Helper to calculate weighted combined rating (Baseline Seed + Live Customer Reviews)
const computeProductRatingStats = async (productId) => {
  const product = await Product.findOne({ id: productId });
  const baseRating = Number(product?.baseRating || 4.8);
  const baseCount = Number(product?.baseRatingCount || 100);

  const reviews = await Review.find({ productId }).populate('userId', 'name').sort({ createdAt: -1 });
  const liveReviewsCount = reviews.length;
  const liveRatingsSum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);

  // Weighted formula preserves existing catalog ratings and blends new live reviews
  const totalRatings = baseCount + liveReviewsCount;
  const averageRating = totalRatings > 0
    ? parseFloat((((baseRating * baseCount) + liveRatingsSum) / totalRatings).toFixed(1))
    : baseRating;

  return {
    reviews,
    stats: {
      totalRatings,
      averageRating,
      liveReviewsCount,
    },
  };
};

// Get reviews for a product
exports.getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { reviews, stats } = await computeProductRatingStats(productId);

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
    const userId = req.user._id;

    if (!productId || !rating) {
      return res.status(400).json({ success: false, message: 'Product ID and Rating are required' });
    }

    // Check if the user has purchased the item
    const hasPurchased = await Order.exists({
      'customer.userId': userId,
      'items.productId': productId,
      status: 'Delivered',
    });

    const review = await Review.create({
      productId,
      userId,
      rating: Number(rating),
      title: title || '',
      comment: comment || '',
      isVerifiedPurchase: !!hasPurchased,
    });

    // Populate user info so caller receives user name immediately
    await review.populate('userId', 'name');

    // Recalculate combined stats (Baseline + Live Customer Reviews)
    const { stats } = await computeProductRatingStats(productId);

    // Persist and sync directly into MongoDB Atlas Product document
    await Product.findOneAndUpdate(
      { id: productId },
      { rating: stats.averageRating, ratingCount: stats.totalRatings }
    );

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

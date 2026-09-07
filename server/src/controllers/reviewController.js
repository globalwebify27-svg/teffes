const Review = require('../models/Review');
const Order = require('../models/Order');

// Get reviews for a product
exports.getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ productId }).populate('userId', 'name').sort({ createdAt: -1 });

    const totalRatings = reviews.length;
    const averageRating = totalRatings > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalRatings).toFixed(1)
      : 0;

    res.status(200).json({
      success: true,
      reviews,
      stats: {
        totalRatings,
        averageRating,
      },
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
      rating,
      title,
      comment,
      isVerifiedPurchase: !!hasPurchased,
    });

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      review,
    });
  } catch (error) {
    next(error);
  }
};

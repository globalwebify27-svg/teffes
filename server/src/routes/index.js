const { Router } = require('express');
const authRoutes = require('./auth.routes');
const productRoutes = require('./product.routes');
const storeAdminRoutes = require('./storeAdmin.routes');
const superAdminRoutes = require('./superAdmin.routes');
const userRoutes = require('./user.routes');
const orderRoutes = require('./order.routes');
const paymentRoutes = require('./payment.routes');
const couponRoutes = require('./coupon.routes');
const walletRoutes = require('./wallet.routes');
const reviewRoutes = require('./review.routes');
const { protect } = require('../middlewares/auth');
const Order = require('../models/Order');
const Store = require('../models/Store');

const router = Router();

router.use('/auth', authRoutes);
router.use('/', productRoutes); // provides /categories, /products, /products/:id
router.use('/user', userRoutes); // provides persistent /user/cart, /user/wishlist
router.use('/orders', orderRoutes);
router.use('/payment', paymentRoutes);
router.use('/coupons', couponRoutes);
router.use('/banners', require('./banner.routes'));
router.use('/wallet', walletRoutes);
router.use('/reviews', reviewRoutes);
router.use('/transfers', require('./transfer.routes'));
router.use('/store-admin', storeAdminRoutes);
router.use('/super-admin', superAdminRoutes);
router.use('/rider', require('./rider.routes'));

// Public stores listing for customer store pickup & selection
router.get('/stores', async (req, res, next) => {
  try {
    const stores = await Store.find({ status: { $ne: 'Inactive' } }).sort({ storeId: 1 });
    res.status(200).json({ success: true, count: stores.length, stores });
  } catch (error) {
    next(error);
  }
});

// Customer Orders & Tracking
router.get('/orders/my-orders', protect, async (req, res, next) => {
  try {
    const orders = await Order.find({
      $or: [
        { 'customer.userId': req.user._id },
        { 'customer.phone': req.user.phone },
        { 'customer.email': req.user.email },
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    next(error);
  }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({
      $or: [{ orderId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

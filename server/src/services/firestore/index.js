const categoryService = require('./category.firestore.service');
const bannerService = require('./banner.firestore.service');
const siteSettingsService = require('./siteSettings.firestore.service');
const crossSellService = require('./crossSell.firestore.service');
const productService = require('./product.firestore.service');
const storeService = require('./store.firestore.service');
const inventoryService = require('./inventory.firestore.service');
const userService = require('./user.firestore.service');
const couponService = require('./coupon.firestore.service');
const walletService = require('./wallet.firestore.service');
const orderService = require('./order.firestore.service');
const deliverySlotService = require('./deliverySlot.firestore.service');
const returnService = require('./return.firestore.service');
const reviewService = require('./review.firestore.service');
const sosService = require('./sos.firestore.service');
const remittanceService = require('./remittance.firestore.service');
const transferService = require('./transfer.firestore.service');

module.exports = {
  categoryService,
  bannerService,
  siteSettingsService,
  crossSellService,
  productService,
  storeService,
  inventoryService,
  userService,
  couponService,
  walletService,
  orderService,
  deliverySlotService,
  returnService,
  reviewService,
  sosService,
  remittanceService,
  transferService,
};

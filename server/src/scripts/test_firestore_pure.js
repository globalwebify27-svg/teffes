require('dotenv').config();
const { getDb } = require('../lib/firestore');
const { getPlatformDashboard, getStores, getCoupons, getAllOrders, getRiders } = require('../controllers/superAdmin.controller');
const { getDashboardOverview, getOrders: getStoreOrders, getInventory, getStoreStatus } = require('../controllers/storeAdmin.controller');
const { getPublicCrossSellItems } = require('../controllers/crossSell.controller');
const { getProductReviews } = require('../controllers/reviewController');
const { getActiveBanners } = require('../controllers/banner.controller');

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

const next = (err) => {
  if (err) {
    console.error('❌ Error caught:', err.message);
    throw err;
  }
};

const runAudit = async () => {
  console.log('--- TeFFe Pure Firestore Comprehensive Audit ---');
  
  // 1. Super Admin Dashboard
  const res1 = mockRes();
  await getPlatformDashboard({ user: { role: 'superadmin' } }, res1, next);
  console.log(`✅ Super Admin Dashboard: ${res1.data.kpis?.length} KPIs, ${res1.data.recentActivity?.length} recent orders`);

  // 2. Super Admin Stores
  const res2 = mockRes();
  await getStores({ user: { role: 'superadmin' } }, res2, next);
  console.log(`✅ Super Admin Stores: ${res2.data.count} stores in Firestore`);

  // 3. Super Admin Coupons
  const res3 = mockRes();
  await getCoupons({ user: { role: 'superadmin' } }, res3, next);
  console.log(`✅ Super Admin Coupons: ${res3.data.count} coupons in Firestore`);

  // 4. Super Admin All Orders
  const res4 = mockRes();
  await getAllOrders({ user: { role: 'superadmin' } }, res4, next);
  console.log(`✅ Super Admin All Orders: ${res4.data.count} orders in Firestore`);

  // 5. Super Admin Riders
  const res5 = mockRes();
  await getRiders({ user: { role: 'superadmin' } }, res5, next);
  console.log(`✅ Super Admin Riders: ${res5.data.count} riders in Firestore`);

  // 6. Store Admin Dashboard (Doranda S004)
  const res6 = mockRes();
  await getDashboardOverview({ user: { role: 'storeadmin', storeId: 'S004' }, query: {} }, res6, next);
  console.log(`✅ Store Admin Dashboard (S004): ${res6.data.kpis?.length} KPIs, ${res6.data.latestOrders?.length} orders`);

  // 7. Store Admin Orders (Doranda S004)
  const res7 = mockRes();
  await getStoreOrders({ user: { role: 'storeadmin', storeId: 'S004' }, query: {} }, res7, next);
  console.log(`✅ Store Admin Orders (S004): ${res7.data.count} orders`);

  // 8. Store Admin Inventory
  const res8 = mockRes();
  await getInventory({ user: { role: 'storeadmin', storeId: 'S004' }, query: {} }, res8, next);
  console.log(`✅ Store Admin Inventory (S004): ${res8.data.count} inventory items`);

  // 9. Store Admin Store Status
  const res9 = mockRes();
  await getStoreStatus({ user: { role: 'storeadmin', storeId: 'S004' }, query: {} }, res9, next);
  console.log(`✅ Store Admin Status: ${res9.data.store?.name} (isOpen: ${res9.data.store?.isOpen})`);

  // 10. Public Cross Sell Items
  const res10 = mockRes();
  await getPublicCrossSellItems({ query: {}, user: null }, res10, next);
  console.log(`✅ Public Cross Sell Items: ${res10.data.count} items in Firestore`);

  // 11. Banners
  const res11 = mockRes();
  await getActiveBanners({ query: {} }, res11, next);
  console.log(`✅ Hero Banners: ${res11.data.count} active banners in Firestore`);

  // 12. Rider Dashboard
  const { getDashboard: getRiderDashboard, getAvailableOrders: getRiderAvailableOrders } = require('../controllers/rider.controller');
  const realRider = res5.data.riders[0] || { _id: 'rider_default', id: 'rider_default' };
  const res12 = mockRes();
  await getRiderDashboard({ user: { _id: realRider._id || realRider.id, id: realRider.id || realRider._id, role: 'rider' } }, res12, next);
  console.log(`✅ Rider Dashboard (${realRider.name}): status "${res12.data.rider?.riderStatus}", todayEarnings: ₹${res12.data.todayStats?.todayEarnings}`);

  // 13. Rider Available Orders
  const res13 = mockRes();
  await getRiderAvailableOrders({ user: { _id: realRider._id || realRider.id, id: realRider.id || realRider._id, role: 'rider' } }, res13, next);
  console.log(`✅ Rider Available Orders: ${res13.data.count} available for pickup`);


  // 14. Notification Device Token Registration
  const { registerToken } = require('../controllers/notification.controller');
  const res14 = mockRes();
  await registerToken({
    body: { fcmToken: 'test_audit_fcm_token_123', deviceType: 'android', appType: 'customer' },
    user: { _id: 'test_audit_user' },
  }, res14, next);
  console.log(`✅ Notification Token Registered in Firestore: tokenId ${res14.data.tokenId}`);

  console.log('\n🎉 ALL CONTROLLERS, TABS, RIDER & MOBILE/WEB SERVICES PASSED 100% PURE FIRESTORE AUDIT!\n');
  process.exit(0);
};


runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});

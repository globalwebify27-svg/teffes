const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const { getDb, createDoc, updateDoc } = require('../../../lib/firestore');
const {
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
} = require('../index');

const E2E_PREFIX = 'E2E_P7_' + Date.now();

// Fixtures
const storeIdAlpha = `${E2E_PREFIX}_STORE_ALPHA`;
const storeIdBeta = `${E2E_PREFIX}_STORE_BETA`;
const productIdChicken = `${E2E_PREFIX}_prod_chicken`.toLowerCase();
const productIdMutton = `${E2E_PREFIX}_prod_mutton`.toLowerCase();
const categorySlug = `${E2E_PREFIX}_cat_fresh_meat`.toLowerCase();

const customerA = {
  uid: `${E2E_PREFIX}_UID_CUST_A`,
  phone: '9888111001',
  name: 'Ananya Roy',
  email: 'ananya@example.com',
};

const customerB = {
  uid: `${E2E_PREFIX}_UID_CUST_B`,
  phone: '9888111002',
  name: 'Vikram Singh',
  email: 'vikram@example.com',
};

const storeAdminAlpha = {
  id: `${E2E_PREFIX}_UID_ADMIN_ALPHA`,
  uid: `${E2E_PREFIX}_UID_ADMIN_ALPHA`,
  phone: '9888111003',
  name: 'Store Admin Alpha',
  email: 'admin.alpha@teffes.com',
  role: 'storeadmin',
  storeId: storeIdAlpha,
};

const riderSpeed = {
  id: `${E2E_PREFIX}_UID_RIDER_SPEED`,
  uid: `${E2E_PREFIX}_UID_RIDER_SPEED`,
  phone: '9888111004',
  name: 'Rider Speed',
  email: 'speed@teffes.com',
  role: 'rider',
  storeId: storeIdAlpha,
};

const superAdmin = {
  id: `${E2E_PREFIX}_UID_SUPER`,
  uid: `${E2E_PREFIX}_UID_SUPER`,
  phone: '9888111005',
  name: 'Super Admin',
  email: 'super@teffes.com',
  role: 'superadmin',
};

// Tracking created test records for 100% clean deletion
const tracked = {
  users: [],
  categories: [],
  banners: [],
  crossSell: [],
  products: [],
  stores: [],
  inventory: [],
  slots: [],
  orders: [],
  coupons: [],
  wallets: [],
  returns: [],
  reviews: [],
  sos: [],
  remittances: [],
  transfers: [],
};

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

async function runE2EVerification() {
  console.log('\n================================================================');
  console.log('--- PHASE 7: END-TO-END MULTI-PLATFORM VERIFICATION SUITE ---');
  console.log('================================================================\n');

  // ===========================================================================
  // SECTION 1: MASTER DATA & STORES PROVISIONING
  // ===========================================================================
  console.log('>> SECTION 1: Master Data & Catalog Infrastructure');

  await runTest('Master Data: create category, banners, and cross-sell items', async () => {
    // 1. Category
    const cat = await categoryService.createCategory({
      name: 'Fresh Cuts',
      slug: categorySlug,
      image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f',
      order: 1,
    });
    tracked.categories.push(cat.id);
    assert.strictEqual(cat.slug, categorySlug);

    // 2. Banner
    const banner = await bannerService.createBanner({
      title: 'Sunday Meat Fest',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947',
      link: '/categories/fresh-cuts',
      order: 1,
    });
    tracked.banners.push(banner.id);
    assert.strictEqual(banner.title, 'Sunday Meat Fest');

    // 3. Cross-sell item
    const cross = await crossSellService.createCrossSellItem({
      id: `${E2E_PREFIX}_cross_biryani_masala`.toLowerCase(),
      name: 'Special Biryani Masala',
      price: 49,
      unit: 'pack',
      image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d',
    });
    tracked.crossSell.push(cross.id);
    assert.strictEqual(cross.name, 'Special Biryani Masala');
  });

  await runTest('Stores & Inventory: provision dual dark stores and stock items', async () => {
    // Store Alpha (Kishore Ganj Hub)
    await storeService.createStore({
      storeId: storeIdAlpha,
      name: 'Kishore Ganj Dark Store',
      city: 'Ranchi',
      address: 'Harmu Road, Ranchi, Jharkhand 834001',
      isOpen: true,
      deliveryRadiusKm: 15,
      location: { lat: 23.3441, lng: 85.3096 },
    });
    tracked.stores.push(storeIdAlpha);

    // Store Beta (Lalpur Hub)
    await storeService.createStore({
      storeId: storeIdBeta,
      name: 'Lalpur Dark Store',
      city: 'Ranchi',
      address: 'Circular Road, Lalpur, Ranchi, Jharkhand 834001',
      isOpen: true,
      deliveryRadiusKm: 15,
      location: { lat: 23.3688, lng: 85.3344 },
    });
    tracked.stores.push(storeIdBeta);

    // Products
    const prod1 = await productService.createProduct({
      id: productIdChicken,
      name: 'Farm Fresh Chicken Curry Cut',
      category: 'Fresh Cuts',
      price: 240,
      image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781',
      baseRating: 4.8,
      baseRatingCount: 50,
    });
    tracked.products.push(prod1.id);

    const prod2 = await productService.createProduct({
      id: productIdMutton,
      name: 'Tender Mutton Curry Cut',
      category: 'Fresh Cuts',
      price: 680,
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947',
      baseRating: 4.7,
      baseRatingCount: 30,
    });
    tracked.products.push(prod2.id);

    // Stock in Store Alpha
    await inventoryService.createInventoryItem({
      storeId: storeIdAlpha,
      itemId: productIdChicken,
      item: 'Farm Fresh Chicken Curry Cut',
      category: 'Fresh Cuts',
      stock: 20,
      minThreshold: 5,
    });
    tracked.inventory.push({ storeId: storeIdAlpha, itemId: productIdChicken });

    await inventoryService.createInventoryItem({
      storeId: storeIdAlpha,
      itemId: productIdMutton,
      item: 'Tender Mutton Curry Cut',
      category: 'Fresh Cuts',
      stock: 15,
      minThreshold: 3,
    });
    tracked.inventory.push({ storeId: storeIdAlpha, itemId: productIdMutton });

    // Stock in Store Beta
    await inventoryService.createInventoryItem({
      storeId: storeIdBeta,
      itemId: productIdChicken,
      item: 'Farm Fresh Chicken Curry Cut',
      category: 'Fresh Cuts',
      stock: 10,
      minThreshold: 5,
    });
    tracked.inventory.push({ storeId: storeIdBeta, itemId: productIdChicken });
  });

  // ===========================================================================
  // SECTION 2: CUSTOMER JOURNEY (WEBSITE & APP)
  // ===========================================================================
  console.log('\n>> SECTION 2: Customer Website & App Journey');

  let customerAProfile = null;
  let orderIdCOD = '';
  let orderIdWallet = '';
  let createdCouponCode = '';

  await runTest('Customer Journey: authentication and profile initialization', async () => {
    // 1. Login / Sign-up via Firebase UID
    customerAProfile = await userService.findOrCreateFirebaseCustomer({
      firebaseUid: customerA.uid,
      phone: customerA.phone,
      name: customerA.name,
      email: customerA.email,
    });
    tracked.users.push(customerAProfile.id);

    assert.strictEqual(customerAProfile.role, 'customer');
    assert.strictEqual(customerAProfile.phone, customerA.phone);
    assert.strictEqual(customerAProfile.walletBalance, 0);

    // 2. Add delivery address
    const addresses = await userService.addAddress(customerAProfile.id, {
      street: 'Flat 402, Royal Residency, Harmu',
      city: 'Ranchi',
      state: 'Jharkhand',
      pincode: '834002',
      isDefault: true,
      label: 'Home',
    });
    assert.strictEqual(addresses.length, 1);
    assert.strictEqual(addresses[0].isDefault, true);

    // 3. Update cart
    const updatedCart = await userService.updateCart(customerAProfile.id, [
      { productId: productIdChicken, name: 'Farm Fresh Chicken Curry Cut', price: 240, quantity: 2 },
    ]);
    assert.strictEqual(updatedCart.length, 1);

  });

  await runTest('Customer Journey: browse store, validate coupon, and place COD order', async () => {
    // 1. Coupon setup
    createdCouponCode = `${E2E_PREFIX}_SAVE50`;
    const coupon = await couponService.createCoupon({
      code: createdCouponCode,
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 200,
      maxDiscountAmount: 50,
      isActive: true,
    });
    tracked.coupons.push(coupon.id);

    const couponVal = await couponService.validateCouponEligibility({
      couponCode: createdCouponCode,
      orderAmount: 480,
    });
    assert.strictEqual(couponVal.isValid, true);
    assert.strictEqual(couponVal.discount, 48);

    // 2. Checkout COD order (₹480 subtotal - ₹48 discount + ₹50 express delivery fee = ₹482)
    orderIdCOD = `${E2E_PREFIX}_ORD_COD`;
    const orderRes = await orderService.createOrderTransactional({
      orderId: orderIdCOD,
      customer: {
        userId: customerAProfile.id,
        name: customerAProfile.name,
        phone: customerAProfile.phone,
      },
      storeId: storeIdAlpha,
      deliveryAddress: {
        street: 'Flat 402, Royal Residency, Harmu',
        city: 'Ranchi',
        pincode: '834002',
      },
      items: [
        { productId: productIdChicken, name: 'Farm Fresh Chicken Curry Cut', price: 240, quantity: 2 },
      ],
      couponCode: createdCouponCode,
      paymentMethod: 'Cash on Delivery (COD)',
      deliverySlot: '60 Mins Express Delivery',
    });
    tracked.orders.push(orderIdCOD);

    assert.strictEqual(orderRes.success, true);
    assert.strictEqual(orderRes.order.status, 'Pending');
    assert.strictEqual(orderRes.order.discountAmount, 48);
    assert.strictEqual(orderRes.order.amount, 482); // 480 subtotal - 48 discount + 50 express delivery fee
    assert.strictEqual(orderRes.order.isInventoryDeducted, true);

    // Verify stock in Store Alpha decremented from 20 to 18
    const inv = await inventoryService.getInventoryItem(storeIdAlpha, productIdChicken);
    assert.strictEqual(inv.stock, 18);
  });

  await runTest('Customer Journey: wallet credit and wallet-based order placement', async () => {
    // 1. Credit wallet
    tracked.wallets.push(customerAProfile.id);
    const creditRes = await walletService.creditWalletTransactional({
      userId: customerAProfile.id,
      amount: 1000,
      description: 'UPI Wallet Topup',
    });
    assert.strictEqual(creditRes.balance, 1000);

    // 2. Checkout order paid via TeFFe Wallet
    orderIdWallet = `${E2E_PREFIX}_ORD_WALLET`;
    const orderRes = await orderService.createOrderTransactional({
      orderId: orderIdWallet,
      customer: {
        userId: customerAProfile.id,
        name: customerAProfile.name,
        phone: customerAProfile.phone,
      },
      storeId: storeIdAlpha,
      deliveryAddress: {
        street: 'Flat 402, Royal Residency, Harmu',
        city: 'Ranchi',
        pincode: '834002',
      },
      items: [
        { productId: productIdMutton, name: 'Tender Mutton Curry Cut', price: 680, quantity: 1 },
      ],
      paymentMethod: 'TeFFe Cash (Wallet)',
      deliverySlot: 'Standard Delivery',
    });
    tracked.orders.push(orderIdWallet);

    assert.strictEqual(orderRes.success, true);
    assert.strictEqual(orderRes.order.status, 'Pending');
    assert.strictEqual(orderRes.order.paymentStatus, 'Paid');

    // Verify customer's wallet balance decremented from 1000 to 320 (1000 - 680)
    const walletBal = await walletService.getWalletBalance(customerAProfile.id);
    assert.strictEqual(walletBal, 320);

    // Verify Mutton stock in Store Alpha decremented from 15 to 14
    const inv = await inventoryService.getInventoryItem(storeIdAlpha, productIdMutton);
    assert.strictEqual(inv.stock, 14);
  });

  await runTest('Customer Journey: order cancellation atomically restocks inventory and refunds wallet', async () => {
    const cancelRes = await orderService.cancelOrderTransactional(
      orderIdWallet,
      'Customer requested cancellation before butchery prep',
      { id: customerAProfile.id, role: 'customer' }
    );
    assert.strictEqual(cancelRes.success, true);

    // Verify inventory restored back to 15
    const inv = await inventoryService.getInventoryItem(storeIdAlpha, productIdMutton);
    assert.strictEqual(inv.stock, 15);

    // Verify wallet refunded back to 1000
    const walletBal = await walletService.getWalletBalance(customerAProfile.id);
    assert.strictEqual(walletBal, 1000);
  });

  // ===========================================================================
  // SECTION 3: STORE ADMIN JOURNEY
  // ===========================================================================
  console.log('\n>> SECTION 3: Store Admin Operations Journey');

  let slotDocId = '';
  await runTest('Store Admin: provision store admin, manage delivery slots, and transition orders', async () => {
    // 1. Provision Store Admin
    const adminUser = await userService.createPrivilegedUser({
      name: storeAdminAlpha.name,
      email: storeAdminAlpha.email,
      phone: storeAdminAlpha.phone,
      role: 'storeadmin',
      storeId: storeIdAlpha,
    }, superAdmin);
    tracked.users.push(adminUser.id);

    // 2. Manage Delivery Slot
    const slot = await deliverySlotService.createDeliverySlot({
      storeId: storeIdAlpha,
      slot: '04:00 PM - 06:00 PM',
      capacity: 10,
      riders: 4,
    });
    slotDocId = slot.id;
    tracked.slots.push(slotDocId);
    assert.strictEqual(slot.status, 'Open');

    // 3. Order status progression ('Pending' -> 'Cutting' -> 'Ready')
    const prep = await orderService.updateOrderStatus(
      orderIdCOD,
      'Cutting',
      { id: storeAdminAlpha.id, role: 'storeadmin' },
      'Butchery and vacuum packaging started'
    );
    assert.strictEqual(prep.status, 'Cutting');

    const ready = await orderService.updateOrderStatus(
      orderIdCOD,
      'Ready',
      { id: storeAdminAlpha.id, role: 'storeadmin' },
      'Packed with ice gel pads'
    );
    assert.strictEqual(ready.status, 'Ready');
  });

  // ===========================================================================
  // SECTION 4: RIDER FLEET JOURNEY
  // ===========================================================================
  console.log('\n>> SECTION 4: Rider Fleet Operations Journey');

  let riderUserId = '';
  await runTest('Rider Fleet: assignment, delivery completion, emergency SOS, and COD reconciliation', async () => {
    // 1. Provision Rider
    const rider = await userService.createPrivilegedUser({
      name: riderSpeed.name,
      email: riderSpeed.email,
      phone: riderSpeed.phone,
      role: 'rider',
      storeId: storeIdAlpha,
    }, superAdmin);
    riderUserId = rider.id;
    tracked.users.push(riderUserId);

    // 2. Dispatch Order to Rider
    await orderService.updateOrderStatus(
      orderIdCOD,
      'Out for Delivery',
      { id: storeAdminAlpha.id, role: 'storeadmin' },
      `Assigned to rider ${riderSpeed.name}`
    );

    // Tag order with rider details
    await updateDoc('orders', orderIdCOD, {
      rider: {
        riderId: riderUserId,
        name: riderSpeed.name,
        phone: riderSpeed.phone,
      },
    });

    // 3. Complete Delivery & collect COD cash (₹432)
    const delivered = await orderService.updateOrderStatus(
      orderIdCOD,
      'Delivered',
      { id: riderUserId, role: 'rider' },
      'Customer verified and received delivery'
    );
    assert.strictEqual(delivered.status, 'Delivered');

    // 4. Trigger Rider SOS Alert
    const sos = await sosService.triggerSosAlert({
      rider: { id: riderUserId, name: riderSpeed.name, phone: riderSpeed.phone, storeId: storeIdAlpha },
      lat: 23.3441,
      lng: 85.3096,
      activeOrderId: orderIdCOD,
      reason: 'Bicycle chain snap near Kishore Ganj chowk',
    });
    tracked.sos.push(sos.alert.id);
    assert.strictEqual(sos.alert.status, 'TRIGGERED');

    // Store admin resolves SOS
    const resolvedSos = await sosService.updateSosStatus({
      alertId: sos.alert.id,
      user: { id: storeAdminAlpha.id, role: 'storeadmin', storeId: storeIdAlpha, name: storeAdminAlpha.name },
      status: 'RESOLVED',
      notes: 'Support vehicle assisted rider',
    });
    assert.strictEqual(resolvedSos.status, 'RESOLVED');

    // 5. COD Remittance & Cash Reconciliation
    // Rider collected ₹432 from COD order
    await updateDoc('orders', orderIdCOD, { cashCollected: 432 });

    const cashInHand = await remittanceService.calculateRiderCashInHand(riderUserId, riderSpeed.phone);
    assert.strictEqual(cashInHand, 432);

    // Rider submits remittance deposit
    const rem = await remittanceService.submitRemittance({
      rider: { id: riderUserId, name: riderSpeed.name, phone: riderSpeed.phone, storeId: storeIdAlpha },
      amount: 432,
      notes: 'Deposit of order cash at dark store vault',
    });
    tracked.remittances.push(rem.remittance.id);
    assert.strictEqual(rem.remittance.status, 'Pending');

    // Store Admin confirms deposit atomically
    const confirmed = await remittanceService.confirmRemittanceTransactional({
      remittanceId: rem.remittance.id,
      adminUser: { id: storeAdminAlpha.id, role: 'storeadmin', storeId: storeIdAlpha, name: storeAdminAlpha.name },
      notes: 'Cash verified and banked in safe',
    });
    assert.strictEqual(confirmed.status, 'Confirmed');

    // Rider cash in hand drops to 0
    const finalCashInHand = await remittanceService.calculateRiderCashInHand(riderUserId, riderSpeed.phone);
    assert.strictEqual(finalCashInHand, 0);
  });

  // ===========================================================================
  // SECTION 5: SUPER ADMIN JOURNEY & INTER-STORE TRANSFERS
  // ===========================================================================
  console.log('\n>> SECTION 5: Super Admin & Cross-Store Inventory Transfers');

  await runTest('Super Admin: atomic inter-store inventory transfer and master settings audit', async () => {
    // Before: Store Alpha has 18 chicken (initial 20 - 2 from COD order = 18). Store Beta has 10 chicken.
    // Transfer 5 units from Alpha to Beta.
    const trf = await transferService.requestStoreTransfer({
      fromStoreId: storeIdAlpha,
      toStoreId: storeIdBeta,
      items: [{ productId: productIdChicken, name: 'Farm Fresh Chicken Curry Cut', quantity: 5, unit: 'kg' }],
      user: superAdmin,
      notes: 'Cross-store rebalance',
    });
    tracked.transfers.push(trf.id);

    const completed = await transferService.completeStoreTransferTransactional({
      transferId: trf.id,
      user: superAdmin,
    });
    assert.strictEqual(completed.status, 'Completed');

    // Store Alpha becomes 13 (18 - 5)
    const invAlpha = await inventoryService.getInventoryItem(storeIdAlpha, productIdChicken);
    assert.strictEqual(invAlpha.stock, 13);

    // Store Beta becomes 15 (10 + 5)
    const invBeta = await inventoryService.getInventoryItem(storeIdBeta, productIdChicken);
    assert.strictEqual(invBeta.stock, 15);
  });

  // ===========================================================================
  // SECTION 6: SECURITY, ROLE RESTRICTIONS & DATA INTEGRITY
  // ===========================================================================
  console.log('\n>> SECTION 6: Security, Role Restrictions & Concurrency Safeguards');

  await runTest('Security: customer cannot self-escalate role or alter financial fields', async () => {
    const maliciousAttempt = await userService.updateUserProfile(customerAProfile.id, {
      role: 'superadmin',
      walletBalance: 999999,
      isVerified: true,
      name: 'Ananya Roy (Hacked)',
    }, customerAProfile);

    // Sanitizer forces role back to customer and ignores wallet balance mutation
    assert.strictEqual(maliciousAttempt.role, 'customer');
    assert.strictEqual(maliciousAttempt.walletBalance, 1000); // Intact
    assert.strictEqual(maliciousAttempt.name, 'Ananya Roy (Hacked)');
  });

  await runTest('Security: customer B cannot access or modify customer A profile or orders', async () => {
    const customerBProfile = await userService.findOrCreateFirebaseCustomer({
      firebaseUid: customerB.uid,
      phone: customerB.phone,
      name: customerB.name,
      email: customerB.email,
    });
    tracked.users.push(customerBProfile.id);

    // Customer B attempts to update Customer A's profile
    await assert.rejects(
      async () => {
        await userService.updateUserProfile(customerAProfile.id, { name: 'Compromised' }, customerBProfile);
      },
      (err) => err.message.includes('Forbidden')
    );
  });

  await runTest('Security: duplicate checkout retry returns existing order without duplicate stock deduction', async () => {
    const idempotencyKey = `${E2E_PREFIX}_IDEMP_KEY_001`;

    // 1st request (Store Alpha chicken has 13 units)
    const orderRes1 = await orderService.createOrderTransactional({
      idempotencyKey,
      orderId: `${E2E_PREFIX}_ORD_IDEMP_1`,
      customer: { userId: customerAProfile.id, name: customerAProfile.name, phone: customerAProfile.phone },
      storeId: storeIdAlpha,
      deliveryAddress: { street: 'Main Road', city: 'Ranchi', pincode: '834001' },
      items: [{ productId: productIdChicken, name: 'Farm Fresh Chicken Curry Cut', price: 240, quantity: 1 }],
      paymentMethod: 'Cash on Delivery (COD)',
    });
    tracked.orders.push(orderRes1.order.orderId);

    // Stock before retry: was 13 -> now 12
    const invAfter1 = await inventoryService.getInventoryItem(storeIdAlpha, productIdChicken);
    assert.strictEqual(invAfter1.stock, 12);

    // 2nd request (duplicate retry with identical idempotencyKey)
    const orderRes2 = await orderService.createOrderTransactional({
      idempotencyKey,
      orderId: 'ANOTHER-ORDER-ID-IGNORED',
      customer: { userId: customerAProfile.id, name: customerAProfile.name, phone: customerAProfile.phone },
      storeId: storeIdAlpha,
      deliveryAddress: { street: 'Main Road', city: 'Ranchi', pincode: '834001' },
      items: [{ productId: productIdChicken, name: 'Farm Fresh Chicken Curry Cut', price: 240, quantity: 1 }],
      paymentMethod: 'Cash on Delivery (COD)',
    });

    // Returns identical order
    assert.strictEqual(orderRes1.order.orderId, orderRes2.order.orderId);
    assert.strictEqual(orderRes2.isDuplicate, true);

    // Stock remains 12 (ZERO double deduction)
    const invAfter2 = await inventoryService.getInventoryItem(storeIdAlpha, productIdChicken);
    assert.strictEqual(invAfter2.stock, 12);
  });

  await runTest('Security: concurrent slot reservation strictly enforces capacity limit', async () => {
    // Current slot capacity = 10, booked = 0.
    // Spawn 12 concurrent single-seat reservations.
    // Exactly 10 must succeed and 2 must be rejected.
    const promises = Array.from({ length: 12 }, () =>
      deliverySlotService.reserveDeliverySlotTransactional({
        slotId: slotDocId,
        quantity: 1,
      }).then(() => true).catch(() => false)
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r === true).length;
    const failCount = results.filter((r) => r === false).length;

    assert.strictEqual(successCount, 10);
    assert.strictEqual(failCount, 2);

    const slot = await deliverySlotService.getDeliverySlot(slotDocId);
    assert.strictEqual(slot.booked, 10);
    assert.strictEqual(slot.status, 'Closed');
  });

  // ===========================================================================
  // SECTION 7: CLEANUP VERIFICATION
  // ===========================================================================
  console.log('\n>> SECTION 7: Test Cleanup & Database Integrity Verification');

  await runTest('Clean up: remove all Phase 7 E2E documents from Firestore', async () => {
    const db = getDb();

    // 1. Users
    for (const id of tracked.users) {
      await userService.deleteUser(id).catch(() => {});
    }

    // 2. Categories
    for (const id of tracked.categories) {
      await categoryService.deleteCategory(id).catch(() => {});
    }

    // 3. Banners
    for (const id of tracked.banners) {
      await bannerService.deleteBanner(id).catch(() => {});
    }

    // 4. CrossSell
    for (const id of tracked.crossSell) {
      await crossSellService.deleteCrossSellItem(id).catch(() => {});
    }

    // 5. Products
    for (const id of tracked.products) {
      await productService.deleteProduct(id).catch(() => {});
    }

    // 6. Slots
    for (const id of tracked.slots) {
      await deliverySlotService.deleteDeliverySlot(id).catch(() => {});
    }

    // 7. Orders
    for (const id of tracked.orders) {
      await orderService.deleteOrder(id).catch(() => {});
    }

    // 8. Coupons
    for (const id of tracked.coupons) {
      await couponService.deleteCoupon(id).catch(() => {});
    }

    // 9. Returns
    for (const id of tracked.returns) {
      await returnService.deleteReturnRequest(id).catch(() => {});
    }

    // 10. Reviews
    for (const id of tracked.reviews) {
      await reviewService.deleteReview(id).catch(() => {});
    }

    // 11. SOS
    for (const id of tracked.sos) {
      await sosService.deleteSosAlert(id).catch(() => {});
    }

    // 12. Remittances
    for (const id of tracked.remittances) {
      await remittanceService.deleteRemittance(id).catch(() => {});
    }

    // 13. Transfers
    for (const id of tracked.transfers) {
      await transferService.deleteStoreTransfer(id).catch(() => {});
    }

    // 14. Inventory
    for (const item of tracked.inventory) {
      await inventoryService.deleteInventoryItem(item.storeId, item.itemId).catch(() => {});
    }

    // 15. Stores
    for (const id of tracked.stores) {
      await storeService.deleteStore(id).catch(() => {});
    }

    // 16. Audit History
    const histories = await db
      .collection('inventory_history')
      .where('storeId', 'in', [storeIdAlpha, storeIdBeta])
      .get();
    for (const doc of histories.docs) {
      await doc.ref.delete();
    }

    // 17. Wallets & Transactions
    for (const userId of tracked.wallets) {
      await db.collection('wallets').doc(userId).delete().catch(() => {});
      const txs = await db.collection('wallet_transactions').where('userId', '==', userId).get();
      for (const d of txs.docs) {
        await d.ref.delete();
      }
    }
  });

  // ===========================================================================
  // SECTION 8: INVARIANTS PRESERVATION CHECK
  // ===========================================================================
  console.log('\n>> SECTION 8: Invariants & Atlas Preservation Check');

  await runTest('Invariants: all 21 Mongoose models remain completely intact and active', async () => {
    const models = [
      'Banner', 'Category', 'Coupon', 'CrossSellItem', 'DeliverySlot',
      'Inventory', 'InventoryHistory', 'NotificationToken', 'OTP', 'Order',
      'Product', 'Remittance', 'ReturnRequest', 'Review', 'RiderNotification',
      'SiteSettings', 'SosAlert', 'Store', 'StoreTransfer', 'User',
      'WalletTransaction',
    ];

    assert.strictEqual(models.length, 21, 'Must check exactly 21 Mongoose models');

    for (const m of models) {
      const Model = require(`../../../models/${m}`);
      assert.ok(Model.schema, `Mongoose model ${m} must be intact and have an active schema`);
    }
  });

  await runTest('Invariants: Firebase Admin remains initialized and accessible', async () => {
    const { isFirebaseReady, getFirestoreInstance } = require('../../../config/firebase');
    assert.strictEqual(isFirebaseReady(), true);
    assert.ok(getFirestoreInstance());
  });

  console.log('\n================================================================');
  console.log(`PHASE 7 E2E TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2EVerification().catch((err) => {
  console.error('E2E runner error:', err);
  process.exit(1);
});

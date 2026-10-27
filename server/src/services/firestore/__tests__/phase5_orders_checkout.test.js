const assert = require('assert');
const {
  orderService,
  couponService,
  walletService,
  inventoryService,
  productService,
  storeService,
  userService,
} = require('../index');
const { getDoc, deleteDoc } = require('../../../lib/firestore');
const { isFirebaseReady } = require('../../../config/firebase');

// Mongoose models to verify schema preservation
const MongoOrder = require('../../../models/Order');
const MongoCoupon = require('../../../models/Coupon');
const MongoWalletTransaction = require('../../../models/WalletTransaction');

async function runPhase5Tests() {
  console.log('--- RUNNING PHASE 5 ORDERS, CHECKOUT, WALLET & COUPONS TESTS ---');
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  };

  const timestamp = Date.now();
  const testUserId = `test_usr_phase5_${timestamp}`;
  const testStoreId = `test_store_phase5_${timestamp}`;
  const testProdId = `test_prod_curry_${timestamp}`;
  const testCouponCode = `TESTSAVE20_${timestamp}`;
  const testOrderId = `TEF-TEST-${timestamp}`;

  // ==========================================
  // Setup Master Test Entities
  // ==========================================
  await test('Setup: provision test user, store, product, and inventory', async () => {
    // 1. User
    await userService.findOrCreateFirebaseCustomer({
      firebaseUid: testUserId,
      phone: `9198700${String(timestamp).slice(-5)}`,
      name: 'Pooja Verma',
      email: 'pooja@example.com',
    });

    // 2. Store
    await storeService.createStore({
      storeId: testStoreId,
      name: 'Ranchi Test Hub Phase 5',
      city: 'Ranchi',
      status: 'Active',
      isOpen: true,
      deliveryRadiusKm: 15,
    });

    // 3. Product
    await productService.createProduct({
      id: testProdId,
      name: 'Mutton Curry Cut 500g',
      category: 'mutton',
      price: 350,
      image: '/mutton.jpg',
      netWeight: '500g',
    });

    // 4. Inventory (initial stock = 10 units, min = 2)
    await inventoryService.createInventoryItem({
      storeId: testStoreId,
      itemId: testProdId,
      item: 'Mutton Curry Cut 500g',
      category: 'mutton',
      stock: 10,
      defreezeStock: 5,
      min: 2,
      unit: 'kg',
    });

    // 5. Coupon (₹50 off on orders >= ₹300, limit = 2 uses)
    await couponService.createCoupon({
      code: testCouponCode,
      description: '₹50 flat discount on orders above ₹300',
      discountType: 'fixed',
      discountValue: 50,
      minOrderAmount: 300,
      usageLimit: 2,
      isActive: true,
    });
  });

  // ==========================================
  // 1. Coupon Service Tests
  // ==========================================
  await test('Coupon: eligibility validation enforces minimum order and computes discount', async () => {
    // Below threshold (₹200 < ₹300) -> invalid
    const invalidCheck = await couponService.validateCouponEligibility({
      couponCode: testCouponCode,
      orderAmount: 200,
      userId: testUserId,
    });
    assert.strictEqual(invalidCheck.isValid, false);
    assert.ok(invalidCheck.error.includes('Minimum order amount'));

    // Above threshold (₹350 >= ₹300) -> valid with ₹50 discount
    const validCheck = await couponService.validateCouponEligibility({
      couponCode: testCouponCode,
      orderAmount: 350,
      userId: testUserId,
    });
    assert.strictEqual(validCheck.isValid, true);
    assert.strictEqual(validCheck.discount, 50);
  });

  // ==========================================
  // 2. Wallet Service Tests
  // ==========================================
  await test('Wallet: credit adds balance and debit enforces non-negative balance', async () => {
    // Initial balance = 0
    const initialBal = await walletService.getWalletBalance(testUserId);
    assert.strictEqual(initialBal, 0);

    // Credit ₹500
    const creditRes = await walletService.creditWalletTransactional({
      userId: testUserId,
      amount: 500,
      description: 'Promotional credit top-up',
    });
    assert.strictEqual(creditRes.success, true);
    assert.strictEqual(creditRes.balance, 500);

    // Debit ₹200 -> balance becomes ₹300
    const debitRes = await walletService.debitWalletTransactional({
      userId: testUserId,
      amount: 200,
      description: 'Trial purchase debit',
    });
    assert.strictEqual(debitRes.success, true);
    assert.strictEqual(debitRes.balance, 300);

    // Attempting to debit ₹400 when balance is ₹300 must fail
    await assert.rejects(
      async () =>
        walletService.debitWalletTransactional({
          userId: testUserId,
          amount: 400,
        }),
      /Insufficient wallet balance/
    );

    // Verify balance remains at ₹300
    const finalBal = await walletService.getWalletBalance(testUserId);
    assert.strictEqual(finalBal, 300);

    // Ledger check
    const txns = await walletService.getWalletTransactions(testUserId);
    assert.strictEqual(txns.length, 2, 'Should have 1 Credit and 1 Debit ledger entry');
  });

  // ==========================================
  // 3. Transactional Checkout & Order Creation
  // ==========================================
  const testIdempotencyKey = `idem_key_${timestamp}`;

  await test('Checkout: atomic order placement deducts stock, applies coupon, and saves snapshot', async () => {
    // Current stock = 10, price = ₹350, ordering 2 units (subtotal = ₹700)
    // Subtotal ₹700 >= ₹399 -> free delivery
    // Coupon ₹50 off -> final payable = ₹650
    const orderRes = await orderService.createOrderTransactional({
      orderId: testOrderId,
      idempotencyKey: testIdempotencyKey,
      customer: {
        userId: testUserId,
        name: 'Pooja Verma',
        phone: '9870011223',
      },
      items: [
        {
          productId: testProdId,
          name: 'Mutton Curry Cut 500g',
          price: 350,
          quantity: 2,
          netWeight: '500g',
        },
      ],
      storeId: testStoreId,
      storeName: 'Ranchi Test Hub Phase 5',
      deliverySlot: '90 Mins Delivery',
      couponCode: testCouponCode,
      paymentMethod: 'Cash on Delivery',
    });

    assert.strictEqual(orderRes.success, true);
    assert.strictEqual(orderRes.isDuplicate, false);
    assert.strictEqual(orderRes.order.orderId, testOrderId);
    assert.strictEqual(orderRes.order.itemsSubtotal, 700);
    assert.strictEqual(orderRes.order.discountAmount, 50);
    assert.strictEqual(orderRes.order.amount, 650);
    assert.strictEqual(orderRes.order.isInventoryDeducted, true);

    // Verify inventory deducted from 10 to 8
    const inv = await inventoryService.getInventoryItem(testStoreId, testProdId);
    assert.strictEqual(inv.stock, 8);

    // Verify coupon usageCount incremented from 0 to 1
    const coupon = await couponService.getCouponByCode(testCouponCode);
    assert.strictEqual(coupon.usageCount, 1);
  });

  await test('Checkout: retry with same idempotencyKey returns existing order without re-deducting', async () => {
    const retryRes = await orderService.createOrderTransactional({
      orderId: 'ANOTHER-ORDER-ID-IGNORED',
      idempotencyKey: testIdempotencyKey,
      customer: { userId: testUserId, phone: '9870011223' },
      items: [{ productId: testProdId, price: 350, quantity: 2 }],
      storeId: testStoreId,
    });

    assert.strictEqual(retryRes.success, true);
    assert.strictEqual(retryRes.isDuplicate, true, 'Must identify duplicate request');
    assert.strictEqual(retryRes.order.orderId, testOrderId);

    // Verify stock was NOT deducted again (still 8)
    const inv = await inventoryService.getInventoryItem(testStoreId, testProdId);
    assert.strictEqual(inv.stock, 8);
  });

  await test('Checkout: order paid via wallet deducts wallet balance atomically', async () => {
    // Current wallet balance = ₹300
    // Order 1 item (price ₹350) -> but wallet only has ₹300 -> must fail with insufficient wallet balance
    await assert.rejects(
      async () =>
        orderService.createOrderTransactional({
          orderId: `TEF-WALLET-FAIL-${timestamp}`,
          customer: { userId: testUserId, phone: '9870011223' },
          items: [{ productId: testProdId, price: 350, quantity: 1 }],
          storeId: testStoreId,
          paymentMethod: 'wallet',
        }),
      /Insufficient wallet balance/
    );

    // Top up wallet with ₹150 -> new balance = ₹450
    await walletService.creditWalletTransactional({
      userId: testUserId,
      amount: 150,
      description: 'Top-up for checkout',
    });

    // Subtotal ₹350 + standard delivery fee ₹40 = ₹390. Wallet has ₹450 -> succeeds!
    const walletOrderRes = await orderService.createOrderTransactional({
      orderId: `TEF-WALLET-OK-${timestamp}`,
      customer: { userId: testUserId, phone: '9870011223' },
      items: [{ productId: testProdId, price: 350, quantity: 1 }],
      storeId: testStoreId,
      deliverySlot: 'Standard Delivery',
      paymentMethod: 'wallet',
    });

    assert.strictEqual(walletOrderRes.success, true);
    assert.strictEqual(walletOrderRes.order.paymentStatus, 'Paid');

    // Balance should now be ₹450 - ₹390 = ₹60
    const remBal = await walletService.getWalletBalance(testUserId);
    assert.strictEqual(remBal, 60);
  });

  // ==========================================
  // 4. Order Status Transitions & Cancellation with Restock
  // ==========================================
  await test('Order Lifecycle: status transitions append to chronological audit timeline', async () => {
    const updated = await orderService.updateOrderStatus(testOrderId, 'Cutting', { role: 'storeadmin' });
    assert.strictEqual(updated.status, 'Cutting');
    assert.ok(updated.timeline.some((t) => t.status === 'Cutting'));

    const ready = await orderService.updateOrderStatus(testOrderId, 'Ready', { role: 'storeadmin' });
    assert.strictEqual(ready.status, 'Ready');
  });

  await test('Order Cancellation: cancels order, restores stock atomically, and records audit trail', async () => {
    // Current stock is 7 (10 - 2 - 1). Cancelling testOrderId (2 units) must restore stock to 9.
    const cancelRes = await orderService.cancelOrderTransactional(
      testOrderId,
      'Customer requested cancellation'
    );
    assert.strictEqual(cancelRes.success, true);

    const cancelledOrder = await orderService.getOrderById(testOrderId);
    assert.strictEqual(cancelledOrder.status, 'Cancelled');
    assert.strictEqual(cancelledOrder.isInventoryRestocked, true);

    const restoredInv = await inventoryService.getInventoryItem(testStoreId, testProdId);
    assert.strictEqual(restoredInv.stock, 9, 'Stock must be restored to 9 units');
  });

  // ==========================================
  // Clean Up Test Probes
  // ==========================================
  await test('Clean up: remove test orders, coupons, stores, products, and wallet ledger', async () => {
    await orderService.deleteOrder(testOrderId);
    await orderService.deleteOrder(`TEF-WALLET-OK-${timestamp}`);
    await couponService.deleteCoupon(testCouponCode);
    await inventoryService.deleteInventoryItem(testStoreId, testProdId);
    await storeService.deleteStore(testStoreId);
    await productService.deleteProduct(testProdId);
    await userService.deleteUser(testUserId);

    // Clean up wallet ledger entries for test user
    const txns = await walletService.getWalletTransactions(testUserId);
    for (const t of txns) {
      await deleteDoc('wallet_transactions', t.id);
    }

    const postOrder = await orderService.getOrderById(testOrderId);
    const postCoupon = await couponService.getCouponByCode(testCouponCode);
    assert.strictEqual(postOrder, null);
    assert.strictEqual(postCoupon, null);
  });

  // ==========================================
  // 5. Invariant Checks
  // ==========================================
  await test('Invariants: Mongoose Order, Coupon, and Wallet schemas remain intact', async () => {
    assert.ok(MongoOrder.schema, 'Order Mongoose schema must exist');
    assert.ok(MongoCoupon.schema, 'Coupon Mongoose schema must exist');
    assert.ok(MongoWalletTransaction.schema, 'WalletTransaction Mongoose schema must exist');
  });

  await test('Invariants: Firebase Admin remains initialized', async () => {
    assert.ok(isFirebaseReady(), 'Firebase Admin must be ready');
  });

  console.log(`\nPHASE 5 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase5Tests().catch((err) => {
    console.error('Fatal Phase 5 test error:', err);
    process.exit(1);
  });
}

module.exports = { runPhase5Tests };

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const { getDb, createDoc, updateDoc } = require('../../../lib/firestore');
const {
  deliverySlotService,
  returnService,
  reviewService,
  sosService,
  remittanceService,
  transferService,
  storeService,
  productService,
  inventoryService,
  orderService,
} = require('../index');

// Prefix to distinguish test data
const TEST_PREFIX = 'PHASE6_TEST_' + Date.now();

// Test fixtures
const testStoreIdA = `${TEST_PREFIX}_STORE_A`;
const testStoreIdB = `${TEST_PREFIX}_STORE_B`;
const testProductId = `${TEST_PREFIX}_prod_1`.toLowerCase();
const testRiderId = `${TEST_PREFIX}_RIDER_1`;
const testCustomerId = `${TEST_PREFIX}_CUST_1`;
const testCustomer2Id = `${TEST_PREFIX}_CUST_2`;
const testAdminId = `${TEST_PREFIX}_ADMIN_1`;

const testStoreAdminUserA = {
  id: testAdminId,
  name: 'Store Admin A',
  role: 'storeadmin',
  storeId: testStoreIdA,
};

const testSuperAdminUser = {
  id: `${TEST_PREFIX}_SUPER_1`,
  name: 'Super Admin',
  role: 'superadmin',
};

const testCustomerUser = {
  id: testCustomerId,
  name: 'Customer One',
  phone: '9998887771',
  role: 'customer',
};

const testCustomer2User = {
  id: testCustomer2Id,
  name: 'Customer Two',
  phone: '9998887772',
  role: 'customer',
};

const testRiderUser = {
  id: testRiderId,
  name: 'Rider Speed',
  phone: '9998887773',
  role: 'rider',
  storeId: testStoreIdA,
};

let createdSlotIds = [];
let createdReturnIds = [];
let createdReviewIds = [];
let createdSosIds = [];
let createdRemittanceIds = [];
let createdTransferIds = [];
let createdOrderIds = [];
let createdHistoryIds = [];

let passedCount = 0;
let failedCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failedCount++;
  }
}

async function runPhase6Tests() {
  console.log('\n--- RUNNING PHASE 6 OPERATIONAL & SUPPORTING MODULES FIRESTORE TESTS ---\n');

  // --- 0. Setup Prerequisites (Store, Product, Inventory, Order) ---
  await test('Prerequisites: provision stores, product, and inventory in Firestore', async () => {
    // Create stores
    await storeService.createStore({
      storeId: testStoreIdA,
      name: 'Hub Store Alpha',
      address: 'Main Road A',
      city: 'Ranchi',
      isOpen: true,
      deliveryRadiusKm: 15,
      location: { lat: 23.3441, lng: 85.3096 },
    });

    await storeService.createStore({
      storeId: testStoreIdB,
      name: 'Hub Store Beta',
      address: 'Harmu Road B',
      city: 'Ranchi',
      isOpen: true,
      deliveryRadiusKm: 15,
      location: { lat: 23.3500, lng: 85.3200 },
    });

    // Create product
    await productService.createProduct({
      id: testProductId,
      name: 'Prime Mutton Curry Cut',
      category: 'Mutton',
      price: 650,
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947',
      baseRating: 4.5,
      baseRatingCount: 10,
    });

    // Create inventory in Store A (stock: 25)
    await inventoryService.createInventoryItem({
      storeId: testStoreIdA,
      itemId: testProductId,
      item: 'Prime Mutton Curry Cut',
      category: 'Mutton',
      stock: 25,
      minThreshold: 5,
    });

    // Create inventory in Store B (stock: 5)
    await inventoryService.createInventoryItem({
      storeId: testStoreIdB,
      itemId: testProductId,
      item: 'Prime Mutton Curry Cut',
      category: 'Mutton',
      stock: 5,
      minThreshold: 5,
    });
  });

  // --- MODULE 1: Delivery Slots & Availability ---
  let slotDocId = '';
  await test('DeliverySlot: createDeliverySlot calculates initial status and creates unique slot', async () => {
    const slot = await deliverySlotService.createDeliverySlot({
      storeId: testStoreIdA,
      slot: '09:00 AM - 11:00 AM',
      capacity: 3,
      riders: 2,
    });

    slotDocId = slot.id;
    createdSlotIds.push(slotDocId);

    assert.strictEqual(slot.storeId, testStoreIdA);
    assert.strictEqual(slot.capacity, 3);
    assert.strictEqual(slot.booked, 0);
    assert.strictEqual(slot.status, 'Open');
  });

  await test('DeliverySlot: duplicate slot creation for the same store is safely rejected', async () => {
    await assert.rejects(
      async () => {
        await deliverySlotService.createDeliverySlot({
          storeId: testStoreIdA,
          slot: '09:00 AM - 11:00 AM',
          capacity: 5,
        });
      },
      (err) => err.message.includes('already exists')
    );
  });

  await test('DeliverySlot: atomic reservation increments booked count and updates status dynamically', async () => {
    const reserved = await deliverySlotService.reserveDeliverySlotTransactional({
      slotId: slotDocId,
      quantity: 2,
    });

    assert.strictEqual(reserved.booked, 2);
    // 2 out of 3 = 66.6% -> 'Filling Fast'
    assert.strictEqual(reserved.status, 'Filling Fast');
  });

  await test('DeliverySlot: concurrent reservation guards prevent overbooking when capacity is exceeded', async () => {
    // 1 slot remains (capacity 3, booked 2). Reserving 2 more must be rejected.
    await assert.rejects(
      async () => {
        await deliverySlotService.reserveDeliverySlotTransactional({
          slotId: slotDocId,
          quantity: 2,
        });
      },
      (err) => err.message.includes('fully booked')
    );

    // Reserve exact remaining 1 slot -> moves to 'Closed'
    const finalSlot = await deliverySlotService.reserveDeliverySlotTransactional({
      slotId: slotDocId,
      quantity: 1,
    });

    assert.strictEqual(finalSlot.booked, 3);
    assert.strictEqual(finalSlot.status, 'Closed');
  });

  await test('DeliverySlot: releaseDeliverySlotTransactional decrements bookings and re-opens slot', async () => {
    const released = await deliverySlotService.releaseDeliverySlotTransactional({
      slotId: slotDocId,
      quantity: 1,
    });

    assert.strictEqual(released.booked, 2);
    assert.strictEqual(released.status, 'Filling Fast');
  });

  // --- MODULE 2: Returns & Exchanges ---
  let testDeliveredOrderId = `${TEST_PREFIX}_ORD_DELIVERED`;
  let testPendingOrderId = `${TEST_PREFIX}_ORD_PENDING`;
  let returnRequestId = '';

  await test('ReturnRequest Setup: create delivered and pending orders for eligibility tests', async () => {
    // 1. Delivered order
    await createDoc('orders', testDeliveredOrderId, {
      orderId: testDeliveredOrderId,
      customer: {
        userId: testCustomerId,
        name: testCustomerUser.name,
        phone: testCustomerUser.phone,
      },
      storeId: testStoreIdA,
      deliveryAddress: { street: 'Main Road', city: 'Ranchi', pincode: '834001' },
      items: [{ productId: testProductId, name: 'Prime Mutton Curry Cut', price: 650, quantity: 1 }],
      paymentMethod: 'Cash on Delivery (COD)',
      status: 'Delivered',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    createdOrderIds.push(testDeliveredOrderId);

    // 2. Pending order
    await createDoc('orders', testPendingOrderId, {
      orderId: testPendingOrderId,
      customer: {
        userId: testCustomerId,
        name: testCustomerUser.name,
        phone: testCustomerUser.phone,
      },
      storeId: testStoreIdA,
      deliveryAddress: { street: 'Main Road', city: 'Ranchi', pincode: '834001' },
      items: [{ productId: testProductId, name: 'Prime Mutton Curry Cut', price: 650, quantity: 1 }],
      paymentMethod: 'Cash on Delivery (COD)',
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    createdOrderIds.push(testPendingOrderId);
  });

  await test('ReturnRequest: rejects return request if order is not in "Delivered" status', async () => {
    await assert.rejects(
      async () => {
        await returnService.requestReturn({
          orderId: testPendingOrderId,
          user: testCustomerUser,
          reason: 'Item was not fresh',
        });
      },
      (err) => err.message.includes('must be \'Delivered\'')
    );
  });

  await test('ReturnRequest: rejects return request from customer who does not own the order', async () => {
    await assert.rejects(
      async () => {
        await returnService.requestReturn({
          orderId: testDeliveredOrderId,
          user: testCustomer2User, // Customer 2 trying to claim Customer 1's order
          reason: 'Wrong delivery',
        });
      },
      (err) => err.message.includes('Forbidden')
    );
  });

  await test('ReturnRequest: customer successfully requests return for delivered order', async () => {
    const returnReq = await returnService.requestReturn({
      orderId: testDeliveredOrderId,
      user: testCustomerUser,
      reason: 'Temperature packaging issue reported on delivery',
      condition: 'Reported within 60 mins guarantee',
    });

    returnRequestId = returnReq.requestId;
    createdReturnIds.push(returnRequestId);

    assert.strictEqual(returnReq.status, 'Pending Review');
    assert.strictEqual(returnReq.orderId, testDeliveredOrderId);
    assert.strictEqual(returnReq.customer, testCustomerUser.name);
  });

  await test('ReturnRequest: duplicate active return request on same order is safely rejected', async () => {
    await assert.rejects(
      async () => {
        await returnService.requestReturn({
          orderId: testDeliveredOrderId,
          user: testCustomerUser,
          reason: 'Duplicate attempt to request exchange',
        });
      },
      (err) => err.message.includes('already exists')
    );
  });

  await test('ReturnRequest: unauthorized user cannot approve or update return status', async () => {
    await assert.rejects(
      async () => {
        await returnService.updateReturnStatus({
          requestId: returnRequestId,
          status: 'Approved',
          adminUser: testCustomerUser, // Customer cannot approve their own return
        });
      },
      (err) => err.message.includes('Forbidden')
    );
  });

  await test('ReturnRequest: store admin can approve and complete return request', async () => {
    const approved = await returnService.updateReturnStatus({
      requestId: returnRequestId,
      status: 'Approved',
      adminUser: testStoreAdminUserA,
      notes: 'Verified packaging photo from customer; exchange approved',
    });
    assert.strictEqual(approved.status, 'Approved');

    const completed = await returnService.updateReturnStatus({
      requestId: returnRequestId,
      status: 'Completed',
      adminUser: testStoreAdminUserA,
      notes: 'Replacement cut delivered to customer',
    });
    assert.strictEqual(completed.status, 'Completed');

    // Terminal state protection: further updates rejected
    await assert.rejects(
      async () => {
        await returnService.updateReturnStatus({
          requestId: returnRequestId,
          status: 'Approved',
          adminUser: testStoreAdminUserA,
        });
      },
      (err) => err.message.includes('already in terminal state')
    );
  });

  // --- MODULE 3: Customer Product Reviews & Ratings ---
  let reviewDocId = '';
  await test('Review: rejects invalid rating scores outside 1 to 5', async () => {
    await assert.rejects(
      async () => {
        await reviewService.addReview({
          productId: testProductId,
          user: testCustomerUser,
          rating: 6,
          comment: 'Invalid rating test',
        });
      },
      (err) => err.message.includes('Rating must be a valid number between 1 and 5')
    );
  });

  await test('Review: rejects review for non-existent product', async () => {
    await assert.rejects(
      async () => {
        await reviewService.addReview({
          productId: 'NON_EXISTENT_PROD_999',
          user: testCustomerUser,
          rating: 5,
        });
      },
      (err) => err.message.includes('does not exist')
    );
  });

  await test('Review: customer creates verified-purchase review and updates aggregated ratings', async () => {
    // Customer 1 purchased and received testProductId in testDeliveredOrderId
    const res = await reviewService.addReview({
      productId: testProductId,
      user: testCustomerUser,
      rating: 5,
      title: 'Tender and juicy mutton',
      comment: 'Freshly cut and cleanly packed. Arrived cold in under 60 minutes.',
      enforceVerifiedOnly: true,
    });

    reviewDocId = res.review.id;
    createdReviewIds.push(reviewDocId);

    assert.strictEqual(res.isVerifiedPurchase, true);
    assert.strictEqual(res.review.rating, 5);

    // Verify aggregated stats: base 10 reviews @ 4.5 = 45 sum + 5 = 50 sum / 11 reviews = 4.5
    const reviewsData = await reviewService.getProductReviews(testProductId);
    assert.strictEqual(reviewsData.stats.liveReviewsCount, 1);
    assert.strictEqual(reviewsData.stats.totalRatings, 11);
    assert.strictEqual(reviewsData.reviews.length, 1);
  });

  await test('Review: duplicate review by the same user for the same product is safely rejected', async () => {
    await assert.rejects(
      async () => {
        await reviewService.addReview({
          productId: testProductId,
          user: testCustomerUser,
          rating: 4,
          comment: 'Attempting duplicate review',
        });
      },
      (err) => err.message.includes('already submitted a review')
    );
  });

  // --- MODULE 4: Rider SOS Alerts & Emergency Records ---
  let sosAlertId = '';
  await test('SOS: rider triggers SOS alert recording GPS coordinates and honest emergency status', async () => {
    const res = await sosService.triggerSosAlert({
      rider: testRiderUser,
      lat: 23.3441,
      lng: 85.3096,
      activeOrderId: testDeliveredOrderId,
      reason: 'Puncture and flat tyre near Harmu bridge',
    });

    sosAlertId = res.alert.id;
    createdSosIds.push(sosAlertId);

    assert.strictEqual(res.alert.status, 'TRIGGERED');
    assert.strictEqual(res.alert.emergencyServicesDispatched, false); // Honest: no fake 112 dispatch claims
    assert.strictEqual(res.alert.riderId, testRiderId);
    assert.strictEqual(res.alert.storeId, testStoreIdA);
  });

  await test('SOS: prevents another rider from accessing non-owned emergency records', async () => {
    const unauthorizedRider = {
      id: `${TEST_PREFIX}_RIDER_OTHER`,
      role: 'rider',
    };

    await assert.rejects(
      async () => {
        await sosService.getSosAlert(sosAlertId, unauthorizedRider);
      },
      (err) => err.message.includes('Forbidden')
    );
  });

  await test('SOS: store admin acknowledges and resolves SOS alert', async () => {
    const ack = await sosService.updateSosStatus({
      alertId: sosAlertId,
      user: testStoreAdminUserA,
      status: 'ACKNOWLEDGED',
      notes: 'Backup rider dispatched to take over order basket',
    });
    assert.strictEqual(ack.status, 'ACKNOWLEDGED');
    assert.strictEqual(ack.acknowledgedByName, 'Store Admin A');

    const resolved = await sosService.updateSosStatus({
      alertId: sosAlertId,
      user: testStoreAdminUserA,
      status: 'RESOLVED',
      notes: 'Rider assisted; flat tyre repaired',
    });
    assert.strictEqual(resolved.status, 'RESOLVED');
    assert.ok(resolved.resolvedAt);
  });

  // --- MODULE 5: COD Remittance & Cash Reconciliation ---
  let remittanceId = '';
  await test('Remittance Setup: assign rider to delivered COD order to establish cash in hand', async () => {
    // Update delivered order with rider assignment and cashCollected
    await updateDoc('orders', testDeliveredOrderId, {
      rider: {
        riderId: testRiderId,
        name: testRiderUser.name,
        phone: testRiderUser.phone,
      },
      cashCollected: 650,
      paymentMethod: 'Cash on Delivery (COD)',
    });

    const cashInHand = await remittanceService.calculateRiderCashInHand(testRiderId, testRiderUser.phone);
    assert.strictEqual(cashInHand, 650);
  });

  await test('Remittance: rejects deposit amount exceeding verified cash in hand', async () => {
    await assert.rejects(
      async () => {
        await remittanceService.submitRemittance({
          rider: testRiderUser,
          amount: 1000, // exceeds 650 cash in hand
        });
      },
      (err) => err.message.includes('exceeds current verified Cash in Hand')
    );
  });

  await test('Remittance: rider submits valid remittance for hub counter deposit', async () => {
    const res = await remittanceService.submitRemittance({
      rider: testRiderUser,
      amount: 650,
      notes: 'End of shift cash deposit at Kishore Ganj counter',
    });

    remittanceId = res.remittance.id;
    createdRemittanceIds.push(remittanceId);

    assert.strictEqual(res.remittance.status, 'Pending');
    assert.strictEqual(res.remittance.amount, 650);
    assert.strictEqual(res.remainingCashInHand, 0);
  });

  await test('Remittance: rider cannot self-confirm remittance', async () => {
    await assert.rejects(
      async () => {
        await remittanceService.confirmRemittanceTransactional({
          remittanceId,
          adminUser: testRiderUser, // Rider cannot confirm their own cash
        });
      },
      (err) => err.message.includes('Forbidden')
    );
  });

  await test('Remittance: store admin confirms physical cash deposit atomically', async () => {
    const confirmed = await remittanceService.confirmRemittanceTransactional({
      remittanceId,
      adminUser: testStoreAdminUserA,
      notes: 'Cash verified and physically placed in dark store cash vault',
    });

    assert.strictEqual(confirmed.status, 'Confirmed');
    assert.strictEqual(confirmed.confirmedByName, 'Store Admin A');

    // Verify rider cash in hand is now updated to 0 (650 collected - 650 confirmed)
    const newCashInHand = await remittanceService.calculateRiderCashInHand(testRiderId, testRiderUser.phone);
    assert.strictEqual(newCashInHand, 0);
  });

  await test('Remittance: double settlement protection rejects redundant confirmation', async () => {
    await assert.rejects(
      async () => {
        await remittanceService.confirmRemittanceTransactional({
          remittanceId,
          adminUser: testStoreAdminUserA,
        });
      },
      (err) => err.message.includes('already been confirmed and settled')
    );
  });

  // --- MODULE 6: Store-to-Store Inventory Transfers ---
  let transferId = '';
  await test('StoreTransfer: request transfer between different stores validates input and items', async () => {
    // Request from Store A to Store B for 10 units
    const transfer = await transferService.requestStoreTransfer({
      fromStoreId: testStoreIdA,
      toStoreId: testStoreIdB,
      items: [{ productId: testProductId, name: 'Prime Mutton Curry Cut', quantity: 10, unit: 'kg' }],
      user: testStoreAdminUserA,
      notes: 'Transfer stock to balance weekend rush',
    });

    transferId = transfer.id;
    createdTransferIds.push(transferId);

    assert.strictEqual(transfer.status, 'Pending');
    assert.strictEqual(transfer.fromStoreId, testStoreIdA);
    assert.strictEqual(transfer.toStoreId, testStoreIdB);
  });

  await test('StoreTransfer: rejects transfer request where source and destination are identical', async () => {
    await assert.rejects(
      async () => {
        await transferService.requestStoreTransfer({
          fromStoreId: testStoreIdA,
          toStoreId: testStoreIdA,
          items: [{ productId: testProductId, quantity: 5 }],
          user: testStoreAdminUserA,
        });
      },
      (err) => err.message.includes('cannot be the same')
    );
  });

  await test('StoreTransfer: atomic multi-store inventory transfer moves stock and logs audit trail', async () => {
    // Before: Store A has 25 stock, Store B has 5 stock.
    // Transfer 10 units: Store A becomes 15, Store B becomes 15.
    const completed = await transferService.completeStoreTransferTransactional({
      transferId,
      user: testStoreAdminUserA,
    });

    assert.strictEqual(completed.status, 'Completed');
    assert.ok(completed.completedAt);

    // Verify Store A inventory stock = 15
    const storeAItem = await inventoryService.getInventoryItem(testStoreIdA, testProductId);
    assert.strictEqual(storeAItem.stock, 15);

    // Verify Store B inventory stock = 15
    const storeBItem = await inventoryService.getInventoryItem(testStoreIdB, testProductId);
    assert.strictEqual(storeBItem.stock, 15);

    // Verify duplicate execution rejection
    await assert.rejects(
      async () => {
        await transferService.completeStoreTransferTransactional({
          transferId,
          user: testStoreAdminUserA,
        });
      },
      (err) => err.message.includes('already been completed')
    );
  });

  await test('StoreTransfer: atomic transfer fails and aborts if source stock is insufficient', async () => {
    // Request 50 units (Store A only has 15 remaining)
    const largeTransfer = await transferService.requestStoreTransfer({
      fromStoreId: testStoreIdA,
      toStoreId: testStoreIdB,
      items: [{ productId: testProductId, name: 'Prime Mutton Curry Cut', quantity: 50, unit: 'kg' }],
      user: testStoreAdminUserA,
    });
    createdTransferIds.push(largeTransfer.id);

    await assert.rejects(
      async () => {
        await transferService.completeStoreTransferTransactional({
          transferId: largeTransfer.id,
          user: testStoreAdminUserA,
        });
      },
      (err) => err.message.includes('Insufficient stock in source store')
    );

    // Verify Store A stock was NOT modified (still 15)
    const storeAItem = await inventoryService.getInventoryItem(testStoreIdA, testProductId);
    assert.strictEqual(storeAItem.stock, 15);
  });

  // --- CLEANUP ---
  await test('Clean up: remove all Phase 6 operational test documents from Firestore', async () => {
    const db = getDb();

    // Remove slots
    for (const id of createdSlotIds) {
      await deliverySlotService.deleteDeliverySlot(id).catch(() => {});
    }

    // Remove returns
    for (const id of createdReturnIds) {
      await returnService.deleteReturnRequest(id).catch(() => {});
    }

    // Remove reviews
    for (const id of createdReviewIds) {
      await reviewService.deleteReview(id).catch(() => {});
    }

    // Remove SOS
    for (const id of createdSosIds) {
      await sosService.deleteSosAlert(id).catch(() => {});
    }

    // Remove remittances
    for (const id of createdRemittanceIds) {
      await remittanceService.deleteRemittance(id).catch(() => {});
    }

    // Remove transfers
    for (const id of createdTransferIds) {
      await transferService.deleteStoreTransfer(id).catch(() => {});
    }

    // Remove orders
    for (const id of createdOrderIds) {
      await orderService.deleteOrder(id).catch(() => {});
    }

    // Remove stores, product, and inventory
    await inventoryService.deleteInventoryItem(testStoreIdA, testProductId).catch(() => {});
    await inventoryService.deleteInventoryItem(testStoreIdB, testProductId).catch(() => {});
    await productService.deleteProduct(testProductId).catch(() => {});
    await storeService.deleteStore(testStoreIdA).catch(() => {});
    await storeService.deleteStore(testStoreIdB).catch(() => {});

    // Clean any audit history logs generated during test
    const histories = await db
      .collection('inventory_history')
      .where('storeId', 'in', [testStoreIdA, testStoreIdB])
      .get();

    for (const doc of histories.docs) {
      await doc.ref.delete();
    }
  });

  // --- INVARIANTS PRESERVATION ---
  await test('Invariants: Mongoose models remain completely intact and active', async () => {
    const DeliverySlot = require('../../../models/DeliverySlot');
    const ReturnRequest = require('../../../models/ReturnRequest');
    const Review = require('../../../models/Review');
    const SosAlert = require('../../../models/SosAlert');
    const Remittance = require('../../../models/Remittance');
    const StoreTransfer = require('../../../models/StoreTransfer');

    assert.ok(DeliverySlot.schema);
    assert.ok(ReturnRequest.schema);
    assert.ok(Review.schema);
    assert.ok(SosAlert.schema);
    assert.ok(Remittance.schema);
    assert.ok(StoreTransfer.schema);
  });

  await test('Invariants: Firebase Admin remains initialized and accessible', async () => {
    const { isFirebaseReady, getFirestoreInstance } = require('../../../config/firebase');
    assert.strictEqual(isFirebaseReady(), true);
    assert.ok(getFirestoreInstance());
  });

  console.log(`\nPHASE 6 TEST SUMMARY: ${passedCount} Passed, ${failedCount} Failed\n`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error('Test runner encountered an error:', err);
  process.exit(1);
});

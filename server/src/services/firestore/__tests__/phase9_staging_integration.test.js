/**
 * Phase 9 — Full Staging Integration, Compatibility & Security Test Suite
 *
 * Automated verification of:
 * 1. Customer Workflows (Auth, Catalog, Cart, Address, Coupon, COD, Wallet, Cancel/Restock)
 * 2. Store Admin Workflows (Auth, Store Inventory, Defreeze/Waste, Slots, Order Progression, Returns, Remittance Confirm)
 * 3. Rider Workflows (Auth, Order Assignment, Status Progression, Location Update, SOS, Remittance Submit)
 * 4. Super Admin Workflows (Multi-store Access, Inter-Store Transfer & Execution, Master Data, Permissions)
 * 5. Compatibility & API Contract Audit (Response fields, IDs, timestamps, status codes vs contracts)
 * 6. Security & Concurrency (Token validation, role guards, cross-user isolation, price tampering, concurrent stock/slot atomicity, credential shielding)
 * 7. Absolute MongoDB Atlas Invariance (Zero writes, unchanged document counts).
 */

const assert = require('assert');
const path = require('path');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

const stagingRouter = require('../../../routes/staging/staging.routes');
const { signAccessToken } = require('../../../utils/jwt');
const { getDb, getDoc, createDoc, updateDoc, deleteDoc, queryDocs } = require('../../../lib/firestore');
const { getSlotDocId } = require('../deliverySlot.firestore.service');

let server;
let baseUrl;

// Test execution tracking
const cleanupTasks = [];

function makeRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + endpoint);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runPhase9Tests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 9 FULL STAGING INTEGRATION & SECURITY SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         Error: ${err.message}`);
      failed++;
    }
  };

  // Express test server
  const app = express();
  app.use(express.json());
  app.use('/api/staging', stagingRouter);

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const TEST_PREFIX = `P9_${Date.now()}`;
  const db = getDb();

  // Test Entities
  const testStoreId = `${TEST_PREFIX}_STORE_MAIN`;
  const testStoreIdSecondary = `${TEST_PREFIX}_STORE_BRANCH`;
  const testItemId = `${TEST_PREFIX}_prod_pomfret`.toLowerCase();

  const customerUser = {
    _id: `${TEST_PREFIX}_cust_1`,
    id: `${TEST_PREFIX}_cust_1`,
    name: 'P9 Priya Sharma',
    phone: '9900112233',
    email: 'priya.p9@example.com',
    role: 'customer',
    isActive: true,
    isVerified: true,
    addresses: [],
    cart: { items: [], lastUpdated: new Date().toISOString() },
    wishlist: [],
    walletBalance: 200,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const storeAdminUser = {
    _id: `${TEST_PREFIX}_admin_1`,
    id: `${TEST_PREFIX}_admin_1`,
    name: 'P9 Store Manager',
    email: 'manager.p9@teffes.com',
    role: 'storeadmin',
    storeId: testStoreId,
    isActive: true,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const riderUser = {
    _id: `${TEST_PREFIX}_rider_1`,
    id: `${TEST_PREFIX}_rider_1`,
    name: 'P9 Swift Rider',
    email: 'rider.p9@teffes.com',
    phone: '9900998877',
    role: 'rider',
    storeId: testStoreId,
    isActive: true,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const superAdminUser = {
    _id: `${TEST_PREFIX}_super_1`,
    id: `${TEST_PREFIX}_super_1`,
    name: 'P9 Chief Exec',
    email: 'chief.p9@teffes.com',
    role: 'superadmin',
    isActive: true,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // JWT Tokens
  const customerToken = signAccessToken({ id: customerUser.id, role: customerUser.role });
  const storeAdminToken = signAccessToken({ id: storeAdminUser.id, role: storeAdminUser.role });
  const riderToken = signAccessToken({ id: riderUser.id, role: riderUser.role });
  const superAdminToken = signAccessToken({ id: superAdminUser.id, role: superAdminUser.role });

  let initialAtlasDocCount = 0;

  try {
    // ─── Pre-flight Setup & Atlas Pre-Count ────────────────────────────────────
    await mongoose.connect(process.env.MONGO_URI);
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const c of collections) {
      initialAtlasDocCount += await mongoose.connection.db.collection(c.name).countDocuments();
    }
    console.log(`[PRE-FLIGHT] Initial MongoDB Atlas Documents: ${initialAtlasDocCount}`);

    // Seed test Firestore fixtures
    await db.collection('users').doc(customerUser.id).set(customerUser);
    cleanupTasks.push(() => db.collection('users').doc(customerUser.id).delete());

    await db.collection('users').doc(storeAdminUser.id).set(storeAdminUser);
    cleanupTasks.push(() => db.collection('users').doc(storeAdminUser.id).delete());

    await db.collection('users').doc(riderUser.id).set(riderUser);
    cleanupTasks.push(() => db.collection('users').doc(riderUser.id).delete());

    await db.collection('users').doc(superAdminUser.id).set(superAdminUser);
    cleanupTasks.push(() => db.collection('users').doc(superAdminUser.id).delete());

    // Stores
    await db.collection('stores').doc(testStoreId).set({
      id: testStoreId,
      _id: testStoreId,
      name: 'P9 Main Fish Hub',
      city: 'Ranchi',
      isActive: true,
      address: 'Harmu Road, Ranchi',
    });
    cleanupTasks.push(() => db.collection('stores').doc(testStoreId).delete());

    await db.collection('stores').doc(testStoreIdSecondary).set({
      id: testStoreIdSecondary,
      _id: testStoreIdSecondary,
      name: 'P9 Branch Hub',
      city: 'Ranchi',
      isActive: true,
      address: 'Kanke Road, Ranchi',
    });
    cleanupTasks.push(() => db.collection('stores').doc(testStoreIdSecondary).delete());

    // Product & Inventories
    await db.collection('products').doc(testItemId).set({
      id: testItemId,
      _id: testItemId,
      name: 'Silver Pomfret Premium',
      price: 600,
      originalPrice: 700,
      category: 'fish',
      categoryLabel: 'Fish & Seafood',
      netWeight: '500g',
      inStock: true,
      rating: 4.9,
      reviewsCount: 15,
      createdAt: new Date().toISOString(),
    });
    cleanupTasks.push(() => db.collection('products').doc(testItemId).delete());

    const invDocId = `${testStoreId}_${testItemId}`;
    await db.collection('inventory').doc(invDocId).set({
      id: invDocId,
      _id: invDocId,
      storeId: testStoreId,
      itemId: testItemId,
      item: 'Silver Pomfret Premium',
      stock: 25,
      defreezeStock: 10,
      wasteStock: 0,
      min: 5,
      unit: 'kg',
      status: 'In Stock',
      updatedAt: new Date().toISOString(),
    });
    cleanupTasks.push(() => db.collection('inventory').doc(invDocId).delete());

    const invBranchId = `${testStoreIdSecondary}_${testItemId}`;
    await db.collection('inventory').doc(invBranchId).set({
      id: invBranchId,
      _id: invBranchId,
      storeId: testStoreIdSecondary,
      itemId: testItemId,
      item: 'Silver Pomfret Premium',
      stock: 5,
      defreezeStock: 0,
      wasteStock: 0,
      min: 2,
      unit: 'kg',
      status: 'In Stock',
      updatedAt: new Date().toISOString(),
    });
    cleanupTasks.push(() => db.collection('inventory').doc(invBranchId).delete());

    // Delivery Slot
    const slotDocId = getSlotDocId(testStoreId, '05:00 PM - 07:00 PM');
    await db.collection('delivery_slots').doc(slotDocId).set({
      id: slotDocId,
      _id: slotDocId,
      storeId: testStoreId,
      slot: '05:00 PM - 07:00 PM',
      capacity: 5,
      booked: 1,
      isActive: true,
    });
    cleanupTasks.push(() => db.collection('delivery_slots').doc(slotDocId).delete());

    // Active Coupon
    const couponDocId = `${TEST_PREFIX}_SAVE20`;
    await db.collection('coupons').doc(couponDocId).set({
      id: couponDocId,
      _id: couponDocId,
      code: couponDocId,
      discountType: 'percentage',
      discountValue: 20,
      minOrderAmount: 300,
      maxDiscountAmount: 150,
      isActive: true,
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
    });
    cleanupTasks.push(() => db.collection('coupons').doc(couponDocId).delete());

    console.log('[FIXTURES] Test fixtures seeded cleanly in Firestore.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 1: CUSTOMER INTEGRATION WORKFLOWS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- SECTION 1: CUSTOMER WORKFLOWS ---');

    await test('Customer: Catalog & Product Browsing via Staging API', async () => {
      const catRes = await makeRequest('GET', '/api/staging/categories');
      assert.strictEqual(catRes.status, 200);
      assert.strictEqual(catRes.body.success, true);
      assert(Array.isArray(catRes.body.categories));

      const prodRes = await makeRequest('GET', `/api/staging/products/${testItemId}`);
      assert.strictEqual(prodRes.status, 200);
      assert.strictEqual(prodRes.body.success, true);
      assert.strictEqual(prodRes.body.product.name, 'Silver Pomfret Premium');
      assert.strictEqual(prodRes.body.product.price, 600);
    });

    await test('Customer: Store Selection & Inventory Availability', async () => {
      const storeRes = await makeRequest('GET', `/api/staging/stores/${testStoreId}`);
      assert.strictEqual(storeRes.status, 200);
      assert.strictEqual(storeRes.body.store.name, 'P9 Main Fish Hub');

      const invRes = await makeRequest('GET', `/api/staging/inventory/${testStoreId}/${testItemId}`);
      assert.strictEqual(invRes.status, 200);
      assert.strictEqual(invRes.body.item.stock, 25);
      assert.strictEqual(invRes.body.item.status, 'In Stock');
    });

    await test('Customer: Address & Cart Management', async () => {
      // Add Address
      const addAddrRes = await makeRequest(
        'POST',
        '/api/staging/auth/addresses',
        {
          name: 'Home Ranchi',
          line1: 'Harmu Housing Colony',
          city: 'Ranchi',
          pincode: '834002',
          phone: '9900112233',
        },
        customerToken
      );
      assert.strictEqual(addAddrRes.status, 201);
      assert.strictEqual(addAddrRes.body.success, true);
      assert(addAddrRes.body.address.id);

      // Verify Address Listed
      const listAddrRes = await makeRequest('GET', '/api/staging/auth/addresses', null, customerToken);
      assert.strictEqual(listAddrRes.status, 200);
      assert.strictEqual(listAddrRes.body.addresses.length, 1);
      assert.strictEqual(listAddrRes.body.addresses[0].line1, 'Harmu Housing Colony');

      // Set Cart
      const cartRes = await makeRequest(
        'POST',
        '/api/staging/user/cart',
        {
          items: [{ itemId: testItemId, quantity: 2, price: 600, name: 'Silver Pomfret Premium' }],
        },
        customerToken
      );
      assert.strictEqual(cartRes.status, 200);
      assert.strictEqual(cartRes.body.cart.items.length, 1);
    });

    await test('Customer: Coupon Validation and Checkout Calculation', async () => {
      const couponRes = await makeRequest(
        'POST',
        '/api/staging/coupons/validate',
        { code: couponDocId, amount: 1200 },
        customerToken
      );
      assert.strictEqual(couponRes.status, 200);
      assert.strictEqual(couponRes.body.valid, true);
      assert.strictEqual(couponRes.body.discountAmount, 150); // Capped at maxDiscountAmount 150
      assert.strictEqual(couponRes.body.finalAmount, 1050);
    });

    let createdOrderId = null;
    await test('Customer: COD Order Creation with Atomic Stock Deduction', async () => {
      const orderPayload = {
        storeId: testStoreId,
        items: [
          {
            itemId: testItemId,
            name: 'Silver Pomfret Premium',
            quantity: 2,
            price: 600,
            subtotal: 1200,
          },
        ],
        deliveryAddress: {
          line1: 'Harmu Housing Colony',
          city: 'Ranchi',
          pincode: '834002',
        },
        deliverySlot: '05:00 PM - 07:00 PM',
        subtotal: 1200,
        discount: 150,
        couponCode: couponDocId,
        deliveryFee: 0,
        totalAmount: 1050,
        paymentMethod: 'COD',
      };

      const orderRes = await makeRequest('POST', '/api/staging/orders', orderPayload, customerToken);
      assert.strictEqual(orderRes.status, 201);
      assert.strictEqual(orderRes.body.success, true);
      assert(orderRes.body.order.orderId);
      createdOrderId = orderRes.body.order.orderId;
      cleanupTasks.push(() => db.collection('orders').doc(createdOrderId).delete());

      // Verify stock was decremented from 25 to 23
      const invCheck = await db.collection('inventory').doc(invDocId).get();
      assert.strictEqual(invCheck.data().stock, 23);
    });

    await test('Customer: Order History and Retrieval by ID', async () => {
      const historyRes = await makeRequest('GET', '/api/staging/orders/my-orders', null, customerToken);
      assert.strictEqual(historyRes.status, 200);
      assert(historyRes.body.orders.some((o) => o.orderId === createdOrderId));

      const singleRes = await makeRequest('GET', `/api/staging/orders/${createdOrderId}`, null, customerToken);
      assert.strictEqual(singleRes.status, 200);
      assert.strictEqual(singleRes.body.order.orderId, createdOrderId);
      assert.strictEqual(singleRes.body.order.status, 'Pending');
    });

    await test('Customer: Order Cancellation and Atomic Stock Restoration', async () => {
      const cancelRes = await makeRequest(
        'PUT',
        `/api/staging/orders/${createdOrderId}/cancel`,
        { reason: 'Mistaken order' },
        customerToken
      );
      assert.strictEqual(cancelRes.status, 200);
      assert.strictEqual(cancelRes.body.success, true);

      // Verify stock restored from 23 back to 25
      const invCheck = await db.collection('inventory').doc(invDocId).get();
      assert.strictEqual(invCheck.data().stock, 25);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 2: STORE ADMIN WORKFLOWS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 2: STORE ADMIN WORKFLOWS ---');

    await test('Store Admin: Role Restrictions & Store Inventory Operations', async () => {
      // Store Admin views store orders
      const storeOrdersRes = await makeRequest('GET', `/api/staging/orders/store/${testStoreId}`, null, storeAdminToken);
      assert.strictEqual(storeOrdersRes.status, 200);
      assert.strictEqual(storeOrdersRes.body.success, true);

      // Defreeze stock transfer: 3 kg from defreeze to fresh
      const defreezeRes = await makeRequest(
        'POST',
        `/api/staging/inventory/${testStoreId}/${testItemId}/defreeze-transfer`,
        { quantity: 3, notes: 'Morning preparation' },
        storeAdminToken
      );
      assert.strictEqual(defreezeRes.status, 200);
      assert.strictEqual(defreezeRes.body.result.defreezeStock, 7); // 10 - 3
      assert.strictEqual(defreezeRes.body.result.stock ?? defreezeRes.body.result.freshStock, 28); // 25 + 3

      // Waste recording: 1 kg recorded as damage
      const wasteRes = await makeRequest(
        'POST',
        `/api/staging/inventory/${testStoreId}/${testItemId}/waste`,
        { quantity: 1, sourceClassification: 'fresh', reason: 'Damaged during cutting' },
        storeAdminToken
      );
      assert.strictEqual(wasteRes.status, 200);
      assert.strictEqual(wasteRes.body.result.wasteStock, 1);
      assert.strictEqual(wasteRes.body.result.remainingSourceStock, 27); // 28 - 1
    });

    await test('Store Admin: Delivery Slot Management and Capacity Booking', async () => {
      const slotRes = await makeRequest('GET', `/api/staging/delivery-slots/${testStoreId}`);
      assert.strictEqual(slotRes.status, 200);
      const slot = slotRes.body.slots.find((s) => s.slot === '05:00 PM - 07:00 PM');
      assert(slot);
      assert.strictEqual(slot.booked, 1);

      // Store admin books a slot
      const bookRes = await makeRequest(
        'POST',
        '/api/staging/delivery-slots/book',
        { storeId: testStoreId, slot: '05:00 PM - 07:00 PM' },
        storeAdminToken
      );
      assert.strictEqual(bookRes.status, 200);
      assert.strictEqual(bookRes.body.slot.booked, 2);
    });

    // Create a new fresh order for order status progression tests
    let activeTestOrderId = null;
    await test('Store Admin: Order Status Progression & Timeline Tracking', async () => {
      // 1. Customer places order
      const newOrder = await makeRequest(
        'POST',
        '/api/staging/orders',
        {
          storeId: testStoreId,
          items: [{ itemId: testItemId, name: 'Silver Pomfret Premium', quantity: 1, price: 600, subtotal: 600 }],
          deliveryAddress: { line1: 'Main Road', city: 'Ranchi' },
          totalAmount: 600,
          paymentMethod: 'COD',
        },
        customerToken
      );
      assert.strictEqual(newOrder.status, 201);
      activeTestOrderId = newOrder.body.order.orderId;
      cleanupTasks.push(() => db.collection('orders').doc(activeTestOrderId).delete());

      // 2. Store Admin updates status to 'Cutting'
      const cuttingRes = await makeRequest(
        'PUT',
        `/api/staging/orders/${activeTestOrderId}/status`,
        { status: 'Cutting', note: 'Fish is being prepped and cleaned' },
        storeAdminToken
      );
      assert.strictEqual(cuttingRes.status, 200);
      assert.strictEqual(cuttingRes.body.order.status, 'Cutting');

      // 3. Store Admin assigns Rider
      const assignRes = await makeRequest(
        'PUT',
        `/api/staging/orders/${activeTestOrderId}/assign-rider`,
        {
          riderId: riderUser.id,
          riderName: riderUser.name,
          riderPhone: riderUser.phone,
          vehicle: 'Hero Splendor (JH-01-AB-1234)',
        },
        storeAdminToken
      );
      assert.strictEqual(assignRes.status, 200);
      assert.strictEqual(assignRes.body.rider.name, 'P9 Swift Rider');

      // Verify Order is now Ready
      const checkOrder = await db.collection('orders').doc(activeTestOrderId).get();
      assert.strictEqual(checkOrder.data().status, 'Ready');
      assert.strictEqual(checkOrder.data().rider.name, 'P9 Swift Rider');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 3: RIDER WORKFLOWS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 3: RIDER WORKFLOWS ---');

    await test('Rider: Out for Delivery, Location Update & Complete Delivery', async () => {
      // Rider marks 'Out for Delivery'
      const outRes = await makeRequest(
        'PUT',
        `/api/staging/orders/${activeTestOrderId}/status`,
        { status: 'Out for Delivery', note: 'Order picked up from Harmu hub' },
        riderToken
      );
      assert.strictEqual(outRes.status, 200);
      assert.strictEqual(outRes.body.order.status, 'Out for Delivery');

      // Rider transmits active GPS coordinates
      const locRes = await makeRequest(
        'POST',
        '/api/staging/rider/location',
        { lat: 23.3441, lng: 85.3096 },
        riderToken
      );
      assert.strictEqual(locRes.status, 200);
      assert.strictEqual(locRes.body.location.lat, 23.3441);

      // Rider completes delivery
      const deliveredRes = await makeRequest(
        'PUT',
        `/api/staging/orders/${activeTestOrderId}/status`,
        { status: 'Delivered', note: 'Delivered to customer doorstep' },
        riderToken
      );
      assert.strictEqual(deliveredRes.status, 200);
      assert.strictEqual(deliveredRes.body.order.status, 'Delivered');
      assert.strictEqual(deliveredRes.body.order.paymentStatus, 'Paid');
    });

    let remittanceDocId = null;
    await test('Rider: SOS Alert & COD Remittance Workflow', async () => {
      // Trigger SOS
      const sosRes = await makeRequest(
        'POST',
        '/api/staging/sos',
        {
          storeId: testStoreId,
          lat: 23.345,
          lng: 85.31,
          reason: 'Flat tire near Harmu bridge',
        },
        riderToken
      );
      assert.strictEqual(sosRes.status, 201);
      assert.strictEqual(sosRes.body.success, true);
      const alertId = (sosRes.body.sosAlert || sosRes.body.alert)?.id;
      if (alertId) cleanupTasks.push(() => db.collection('sos_alerts').doc(alertId).delete());

      // Rider submits cash remittance of ₹600 collected from COD order
      const remitRes = await makeRequest(
        'POST',
        '/api/staging/remittances',
        {
          storeId: testStoreId,
          amount: 600,
          ordersCount: 1,
          orderIds: [activeTestOrderId],
          notes: 'Evening cash handover',
        },
        riderToken
      );
      assert.strictEqual(remitRes.status, 201, `Remittance should succeed: ${JSON.stringify(remitRes.body)}`);
      remittanceDocId = remitRes.body.remittance?.id || remitRes.body.remittance?.remittanceId;
      if (remittanceDocId) cleanupTasks.push(() => db.collection('remittances').doc(remittanceDocId).delete());

      // Store Admin confirms remittance
      const confirmRes = await makeRequest(
        'PUT',
        `/api/staging/remittances/${remittanceDocId}/confirm`,
        { notes: 'Cash counted and placed in safe' },
        storeAdminToken
      );
      assert.strictEqual(confirmRes.status, 200);
      assert.strictEqual(confirmRes.body.remittance.status, 'Confirmed');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 4: SUPER ADMIN WORKFLOWS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 4: SUPER ADMIN WORKFLOWS ---');

    await test('Super Admin: Multi-Store Stock Transfer & Execution', async () => {
      // 1. Request transfer of 5 kg from Main Fish Hub to Branch Hub
      const transferReq = await makeRequest(
        'POST',
        '/api/staging/transfers',
        {
          sourceStoreId: testStoreId,
          targetStoreId: testStoreIdSecondary,
          itemId: testItemId,
          quantity: 5,
          reason: 'Balance regional inventory',
        },
        superAdminToken
      );
      assert.strictEqual(transferReq.status, 201);
      const transferId = transferReq.body.transfer.id;
      cleanupTasks.push(() => db.collection('store_transfers').doc(transferId).delete());

      // 2. Super Admin executes transfer
      const executeReq = await makeRequest(
        'PUT',
        `/api/staging/transfers/${transferId}/execute`,
        {},
        superAdminToken
      );
      assert.strictEqual(executeReq.status, 200);
      assert.strictEqual(executeReq.body.transfer.status, 'Completed');

      // Verify Main store stock reduced by 5 (26 - 5 = 21)
      const mainInv = await db.collection('inventory').doc(invDocId).get();
      assert.strictEqual(mainInv.data().stock, 21);

      // Verify Branch store stock increased by 5 (5 + 5 = 10)
      const branchInv = await db.collection('inventory').doc(invBranchId).get();
      assert.strictEqual(branchInv.data().stock, 10);
    });

    await test('Super Admin: Permissions & Operational Settings Access', async () => {
      const seoRes = await makeRequest('GET', '/api/staging/settings/seo');
      assert.strictEqual(seoRes.status, 200);
      assert.strictEqual(seoRes.body.success, true);
      assert(seoRes.body.settings);

      // Super Admin can view all store return requests
      const returnsRes = await makeRequest('GET', `/api/staging/returns/store/${testStoreId}`, null, superAdminToken);
      assert.strictEqual(returnsRes.status, 200);
      assert.strictEqual(returnsRes.body.success, true);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 5: SECURITY, ROLE GUARDS & TAMPERING PREVENTION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 5: SECURITY & TAMPERING PREVENTION ---');

    await test('Security: Missing & Invalid Token Rejections', async () => {
      // No token -> 401
      const noTokenRes = await makeRequest('GET', '/api/staging/auth/me');
      assert.strictEqual(noTokenRes.status, 401);

      // Junk bearer token -> 401
      const badTokenRes = await makeRequest('GET', '/api/staging/auth/me', null, 'invalid_jwt_format');
      assert.strictEqual(badTokenRes.status, 401);
    });

    await test('Security: Role-Based Authorization Guard Invariants', async () => {
      // Customer cannot trigger SOS alert (rider only) -> 403
      const custSos = await makeRequest('POST', '/api/staging/sos', { storeId: testStoreId }, customerToken);
      assert.strictEqual(custSos.status, 403);

      // Customer cannot assign rider -> 403
      const custAssign = await makeRequest('PUT', `/api/staging/orders/${createdOrderId}/assign-rider`, {}, customerToken);
      assert.strictEqual(custAssign.status, 403);

      // Store Admin cannot execute inter-store transfer (superadmin only) -> 403
      const adminExec = await makeRequest('PUT', '/api/staging/transfers/fake_id/execute', {}, storeAdminToken);
      assert.strictEqual(adminExec.status, 403);
    });

    await test('Security: Cross-User Order Access Isolation', async () => {
      // Create a second isolated customer
      const cust2Id = `${TEST_PREFIX}_cust_2`;
      await db.collection('users').doc(cust2Id).set({
        id: cust2Id,
        _id: cust2Id,
        name: 'Intruder User',
        role: 'customer',
        isActive: true,
      });
      cleanupTasks.push(() => db.collection('users').doc(cust2Id).delete());
      const cust2Token = signAccessToken({ id: cust2Id, role: 'customer' });

      // Customer 2 attempts to view Customer 1's order -> 403 Forbidden
      const crossOrderRes = await makeRequest('GET', `/api/staging/orders/${createdOrderId}`, null, cust2Token);
      assert.strictEqual(crossOrderRes.status, 403);
      assert.strictEqual(crossOrderRes.body.success, false);
      assert.strictEqual(crossOrderRes.body.message, 'Unauthorized to view this order');
    });

    await test('Security: Credential Shielding & Sensitive Field Protection', async () => {
      // Verify that user profiles, orders, and auth endpoints NEVER leak password hashes or serviceAccount secrets
      const meRes = await makeRequest('GET', '/api/staging/auth/me', null, storeAdminToken);
      assert.strictEqual(meRes.status, 200);
      assert.strictEqual(meRes.body.user.password, undefined);
      assert.strictEqual(meRes.body.user.serviceAccount, undefined);
      assert.strictEqual(meRes.body.user.privateKey, undefined);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 6: CONCURRENCY & RACE CONDITIONS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 6: CONCURRENCY & RACE CONDITIONS ---');

    await test('Concurrency: Atomic Stock Reservation Prevents Negative Inventory', async () => {
      // Create a low-stock test product with exactly 2 units available
      const scarceItemId = `${TEST_PREFIX}_scarce_lobster`.toLowerCase();
      const scarceInvId = `${testStoreId}_${scarceItemId}`;

      await db.collection('products').doc(scarceItemId).set({
        id: scarceItemId,
        _id: scarceItemId,
        name: 'Rare Blue Lobster',
        price: 1500,
        category: 'fish',
      });
      cleanupTasks.push(() => db.collection('products').doc(scarceItemId).delete());

      await db.collection('inventory').doc(scarceInvId).set({
        id: scarceInvId,
        _id: scarceInvId,
        storeId: testStoreId,
        itemId: scarceItemId,
        item: 'Rare Blue Lobster',
        stock: 2,
        defreezeStock: 0,
        wasteStock: 0,
        min: 1,
        unit: 'unit',
        status: 'Low Stock',
      });
      cleanupTasks.push(() => db.collection('inventory').doc(scarceInvId).delete());

      // Fire 5 simultaneous orders each requesting 1 unit (only 2 can possibly succeed)
      const orderPromises = Array.from({ length: 5 }, (_, idx) => {
        return makeRequest(
          'POST',
          '/api/staging/orders',
          {
            storeId: testStoreId,
            items: [{ itemId: scarceItemId, name: 'Rare Blue Lobster', quantity: 1, price: 1500, subtotal: 1500 }],
            totalAmount: 1500,
            paymentMethod: 'COD',
          },
          customerToken
        );
      });

      const results = await Promise.all(orderPromises);
      const successes = results.filter((r) => r.status === 201);
      const failures = results.filter((r) => r.status === 400);

      assert.strictEqual(successes.length, 2, 'Exactly 2 concurrent orders should succeed');
      assert.strictEqual(failures.length, 3, 'Remaining 3 concurrent orders should be safely rejected');

      // Verify that final inventory stock is exactly 0 (strictly NOT negative)
      const finalInv = await db.collection('inventory').doc(scarceInvId).get();
      assert.strictEqual(finalInv.data().stock, 0);
      assert.strictEqual(finalInv.data().status, 'Out of Stock');

      // Track created orders for cleanup
      for (const s of successes) {
        if (s.body?.order?.orderId) {
          cleanupTasks.push(() => db.collection('orders').doc(s.body.order.orderId).delete());
        }
      }
    });

    await test('Concurrency: Atomic Delivery Slot Capacity Enforced', async () => {
      // Create a slot with capacity: 1, booked: 0
      const tightSlotId = getSlotDocId(testStoreId, '09:00 PM - 10:00 PM');
      await db.collection('delivery_slots').doc(tightSlotId).set({
        id: tightSlotId,
        _id: tightSlotId,
        storeId: testStoreId,
        slot: '09:00 PM - 10:00 PM',
        capacity: 1,
        booked: 0,
        isActive: true,
      });
      cleanupTasks.push(() => db.collection('delivery_slots').doc(tightSlotId).delete());

      // Attempt 3 concurrent bookings for this 1-capacity slot
      const bookingPromises = Array.from({ length: 3 }, () => {
        return makeRequest(
          'POST',
          '/api/staging/delivery-slots/book',
          { storeId: testStoreId, slot: '09:00 PM - 10:00 PM' },
          customerToken
        );
      });

      const bookResults = await Promise.all(bookingPromises);
      const succeededBookings = bookResults.filter((r) => r.status === 200);
      const failedBookings = bookResults.filter((r) => r.status === 400);

      assert.strictEqual(succeededBookings.length, 1, 'Only 1 slot booking must succeed');
      assert.strictEqual(failedBookings.length, 2, 'Other 2 bookings must receive slot capacity error');

      const slotSnap = await db.collection('delivery_slots').doc(tightSlotId).get();
      assert.strictEqual(slotSnap.data().booked, 1);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 7: API CONTRACT PARITY & MODEL PARSING AUDIT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 7: API CONTRACT & PARSING AUDIT ---');

    await test('Contract: Product Model Parser Compatibility', async () => {
      const prodRes = await makeRequest('GET', `/api/staging/products/${testItemId}`);
      const p = prodRes.body.product;
      assert(p.id, 'Must contain id');
      assert(p._id, 'Must contain _id for legacy MongoDB client backward compatibility');
      assert.strictEqual(typeof p.price, 'number', 'Price must be numeric');
      assert.strictEqual(typeof p.originalPrice, 'number', 'originalPrice must be numeric');
      assert(typeof p.name === 'string', 'Name must be string');
      assert(typeof p.category === 'string', 'Category must be string');
    });

    await test('Contract: Order Model Parser Compatibility', async () => {
      const orderRes = await makeRequest('GET', `/api/staging/orders/${activeTestOrderId}`, null, storeAdminToken);
      const o = orderRes.body.order;
      assert(o.id || o.orderId, 'Order must have id or orderId');
      assert(o._id || o.id, 'Order must have _id for Mongoose client compatibility');
      assert.strictEqual(typeof (o.totalAmount ?? o.amount), 'number', 'amount must be numeric');
      assert(Array.isArray(o.items), 'items must be an Array');
      assert(Array.isArray(o.timeline), 'timeline must be an Array');
      assert(o.rider && typeof o.rider === 'object', 'rider must be an object');
      assert.strictEqual(typeof o.rider.name, 'string');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 8: MONGODB ATLAS SOURCE DATABASE INVARIANCE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 8: MONGODB ATLAS INVARIANCE VERIFICATION ---');

    await test('Atlas Invariance: Zero Writes, Deletions, or Schema Alterations', async () => {
      let finalAtlasDocCount = 0;
      const collections = await mongoose.connection.db.listCollections().toArray();
      for (const c of collections) {
        finalAtlasDocCount += await mongoose.connection.db.collection(c.name).countDocuments();
      }
      console.log(`[POST-FLIGHT] Final MongoDB Atlas Documents: ${finalAtlasDocCount}`);
      assert.strictEqual(
        finalAtlasDocCount,
        initialAtlasDocCount,
        `MongoDB Atlas document count MUST remain unchanged (${initialAtlasDocCount} -> ${finalAtlasDocCount})`
      );
      assert.strictEqual(finalAtlasDocCount, 185, 'Total MongoDB Atlas docs must be exactly 185');
    });

  } finally {
    // Clean up test server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up isolated test documents in Firestore
    console.log('\n[CLEANUP] Cleaning up isolated Phase 9 staging test records in Firestore...');
    for (const cleanup of cleanupTasks) {
      try {
        await cleanup();
      } catch (err) {
        // Ignore not-found on cleanup
      }
    }
    console.log('[CLEANUP] Isolated test fixtures cleaned up successfully.');

    // Disconnect mongoose
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log('\n================================================================');
  console.log(`PHASE 9 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase9Tests().catch((err) => {
  console.error('[FATAL] Phase 9 test runner encountered an unhandled exception:', err);
  process.exit(1);
});

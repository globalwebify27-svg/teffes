/**
 * Phase 10 — Client & Mobile App Workflow Verification against Staging
 *
 * Simulates real Web and Flutter app request sequences:
 * 1. Customer Authentication & Profile Retrieval (/auth/me)
 * 2. Store Selection & Catalog Fetching (/stores, /products)
 * 3. Cart Modification (/user/cart)
 * 4. Order Checkout with COD (/orders)
 * 5. Order Status Progression (Pending -> Preparing -> Out for Delivery)
 * 6. Order Cancellation & Restocking Verification (/orders/:id/cancel)
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });
const { getDb } = require('../../../lib/firestore');
const { signAccessToken } = require('../../../utils/jwt');

const BASE_URL = 'http://localhost:5000/api/staging';

async function makeApiCall(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const text = await res.text();
  try {
    return { status: res.statusCode || res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.statusCode || res.status, body: text };
  }
}

async function runClientAppWorkflows() {
  console.log('================================================================');
  console.log('📱 TESTING WEB & FLUTTER APP WORKFLOWS AGAINST STAGING API');
  console.log('================================================================\n');

  const db = getDb();
  const TEST_ID = `app_test_${Date.now()}`;
  const cleanups = [];

  // Seed customer user in Firestore
  const testCustomer = {
    _id: `${TEST_ID}_user`,
    id: `${TEST_ID}_user`,
    name: 'Rohan Gupta',
    phone: '9876501234',
    role: 'customer',
    isActive: true,
    cart: { items: [], lastUpdated: new Date().toISOString() },
    addresses: [{ id: 'addr_1', street: 'Harmu Road', city: 'Ranchi', isDefault: true }],
    walletBalance: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.collection('users').doc(testCustomer.id).set(testCustomer);
  cleanups.push(async () => db.collection('users').doc(testCustomer.id).delete());

  // Seed inventory item in S001
  const testItemId = `${TEST_ID}_chicken_breast`;
  const invRef = db.collection('inventory').doc(`S001_${testItemId}`);
  await invRef.set({
    storeId: 'S001',
    itemId: testItemId,
    item: 'Fresh Chicken Breast 500g',
    unit: '500g',
    stock: 15,
    defreezeStock: 0,
    wasteStock: 0,
    min: 2,
    updatedAt: new Date().toISOString(),
  });
  cleanups.push(async () => invRef.delete());

  const customerToken = signAccessToken({ id: testCustomer.id, role: 'customer', phone: testCustomer.phone });

  try {
    // ─── STEP 1: Customer Profile & Auth Check ───
    console.log('👉 [Step 1/6] Customer Authentication & Profile Verification...');
    const meRes = await makeApiCall('GET', '/auth/me', null, customerToken);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.phone, testCustomer.phone);
    console.log(`   ✅ PASS: Customer authenticated successfully as "${meRes.body.user.name}".`);

    // ─── STEP 2: Store Selection & Product Browsing ───
    console.log('\n👉 [Step 2/6] Store Availability & Catalog Fetch...');
    const storesRes = await makeApiCall('GET', '/stores');
    assert.strictEqual(storesRes.status, 200);

    const prodsRes = await makeApiCall('GET', '/products');
    assert.strictEqual(prodsRes.status, 200);
    console.log('   ✅ PASS: Stores and Product Catalog queried successfully.');

    // ─── STEP 3: Cart Synchronization ───
    console.log('\n👉 [Step 3/6] Customer Cart Update...');
    const cartPayload = {
      items: [{ productId: testItemId, name: 'Fresh Chicken Breast 500g', quantity: 2, price: 290 }],
    };
    const cartRes = await makeApiCall('POST', '/user/cart', cartPayload, customerToken);
    assert.strictEqual(cartRes.status, 200);
    console.log('   ✅ PASS: Cart synchronized in Firestore.');

    // ─── STEP 4: COD Order Placement & Atomic Deduction ───
    console.log('\n👉 [Step 4/6] Placing COD Order (Atomic Stock Decrement 15 -> 13)...');
    const orderPayload = {
      storeId: 'S001',
      items: [{ productId: testItemId, name: 'Fresh Chicken Breast 500g', quantity: 2, price: 290 }],
      amount: 580,
      paymentMethod: 'Cash on Delivery',
      deliverySlot: 'Standard 90 Mins',
      customer: {
        userId: testCustomer.id,
        name: testCustomer.name,
        phone: testCustomer.phone,
        address: 'Harmu Road Ranchi',
      },
    };
    const orderRes = await makeApiCall('POST', '/orders', orderPayload, customerToken);
    assert.strictEqual(orderRes.status, 201);
    const createdOrderId = orderRes.body.order?.orderId || orderRes.body.order?.id;
    assert(createdOrderId, 'Order ID must be returned');
    cleanups.push(async () => db.collection('orders').doc(createdOrderId).delete());

    // Verify stock is now 13
    const invSnap1 = await invRef.get();
    assert.strictEqual(invSnap1.data().stock, 13, 'Inventory stock must be decremented from 15 to 13');
    console.log(`   ✅ PASS: Order ${createdOrderId} placed. Inventory decremented (15 -> 13).`);

    // ─── STEP 5: Order Status Progression (Store Admin) ───
    console.log('\n👉 [Step 5/6] Store Admin Progressing Order Status (Pending -> Cutting)...');
    const storeAdminToken = signAccessToken({ id: 'admin_s001', role: 'storeadmin', storeId: 'S001' });
    // Seed admin in Firestore
    await db.collection('users').doc('admin_s001').set({
      id: 'admin_s001',
      role: 'storeadmin',
      storeId: 'S001',
      isActive: true,
    });
    cleanups.push(async () => db.collection('users').doc('admin_s001').delete());

    const statusRes = await makeApiCall('PUT', `/orders/${createdOrderId}/status`, { status: 'Cutting' }, storeAdminToken);
    assert.strictEqual(statusRes.status, 200);
    console.log('   ✅ PASS: Order status updated to "Cutting".');

    // ─── STEP 6: Customer Order Cancellation & Restocking ───
    console.log('\n👉 [Step 6/6] Customer Order Cancellation & Inventory Restock (13 -> 15)...');
    const cancelRes = await makeApiCall('PUT', `/orders/${createdOrderId}/cancel`, { reason: 'Delivery time conflict' }, customerToken);
    assert.strictEqual(cancelRes.status, 200);

    // Verify inventory restored back to 15
    const invSnap2 = await invRef.get();
    assert.strictEqual(invSnap2.data().stock, 15, 'Inventory stock must be restocked to 15');
    console.log('   ✅ PASS: Order cancelled and stock restored back to 15.');

  } finally {
    console.log('\n[CLEANUP] Cleaning staging test fixtures...');
    for (const fn of cleanups) {
      try { await fn(); } catch (_) {}
    }
    console.log('[CLEANUP] Completed.');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 6 WEB & MOBILE CLIENT STAGING WORKFLOWS PASSED CLEANLY');
  console.log('================================================================\n');
}

runClientAppWorkflows().catch((err) => {
  console.error('Workflow test failed:', err);
  process.exit(1);
});

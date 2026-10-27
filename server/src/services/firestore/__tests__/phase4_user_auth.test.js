const assert = require('assert');
const { userService } = require('../index');
const { getDoc } = require('../../../lib/firestore');
const { getAuthInstance, getMessagingInstance, isFirebaseReady } = require('../../../config/firebase');

// Mongoose model to verify MongoDB schema integrity remains intact
const MongoUser = require('../../../models/User');

async function runPhase4Tests() {
  console.log('--- RUNNING PHASE 4 USER PROFILES & ROLE AUTH FIRESTORE SERVICES TESTS ---');
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
  const testFirebaseUid = `test_firebase_uid_${timestamp}`;
  const testPhone = `+9198765${String(timestamp).slice(-5)}`;
  const cleanPhone = testPhone.replace('+91', '');

  // ==========================================
  // 1. Firebase Auth SDK Verification
  // ==========================================
  await test('Firebase Auth: instance is initialized and operational', async () => {
    assert.ok(isFirebaseReady(), 'Firebase Admin must be ready');
    const auth = getAuthInstance();
    assert.ok(auth, 'Auth instance must be defined');
    assert.ok(typeof auth.verifyIdToken === 'function', 'verifyIdToken method must exist');
  });

  // ==========================================
  // 2. Customer Registration & Profile Retrieval
  // ==========================================
  await test('Customer: findOrCreateFirebaseCustomer registers new customer with forced role', async () => {
    const customer = await userService.findOrCreateFirebaseCustomer({
      firebaseUid: testFirebaseUid,
      phone: testPhone,
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.com',
    });

    assert.strictEqual(customer.id, testFirebaseUid);
    assert.strictEqual(customer._id, testFirebaseUid);
    assert.strictEqual(customer.phone, cleanPhone);
    assert.strictEqual(customer.role, 'customer', 'Role must strictly default to customer');
    assert.strictEqual(customer.walletBalance, 0.0, 'Initial wallet balance must be zero');
    assert.strictEqual(customer.isNewUser, true);
    assert.ok(Array.isArray(customer.addresses));
    assert.ok(Array.isArray(customer.cart));
    assert.ok(Array.isArray(customer.wishlist));
  });

  await test('Customer: subsequent login retrieves existing profile without duplicates', async () => {
    const existing = await userService.findOrCreateFirebaseCustomer({
      firebaseUid: testFirebaseUid,
      phone: testPhone,
    });

    assert.strictEqual(existing.id, testFirebaseUid);
    assert.strictEqual(existing.isNewUser, false, 'Must identify as existing user');
    assert.strictEqual(existing.name, 'Rohan Sharma', 'Must retain profile data');
  });

  await test('Customer: lookup by Phone and UID works accurately', async () => {
    const byUid = await userService.getUserByFirebaseUid(testFirebaseUid);
    assert.ok(byUid);
    assert.strictEqual(byUid.id, testFirebaseUid);

    const byPhone = await userService.getUserByPhone(cleanPhone);
    assert.ok(byPhone);
    assert.strictEqual(byPhone.id, testFirebaseUid);
  });

  // ==========================================
  // 3. Security: Role Escalation & Sensitive Fields Guard
  // ==========================================
  await test('Security: customer cannot self-escalate role or modify financial fields', async () => {
    const requestingUser = { id: testFirebaseUid, role: 'customer' };

    // Attempting to modify role and walletBalance
    const updated = await userService.updateUserProfile(
      testFirebaseUid,
      {
        name: 'Rohan Updated',
        role: 'superadmin', // MALICIOUS: Attempting role escalation
        walletBalance: 999999, // MALICIOUS: Attempting wallet balance forgery
      },
      requestingUser
    );

    assert.strictEqual(updated.name, 'Rohan Updated', 'Safe name field should update');
    assert.strictEqual(updated.role, 'customer', 'Role must remain customer');
    assert.strictEqual(updated.walletBalance, 0.0, 'Wallet balance must remain unchanged');
  });

  await test('Security: non-owner cannot modify another user profile', async () => {
    const unauthorizedUser = { id: 'other_user_id', role: 'customer' };

    await assert.rejects(
      async () =>
        userService.updateUserProfile(
          testFirebaseUid,
          { name: 'Hacked Name' },
          unauthorizedUser
        ),
      /Forbidden: You cannot modify another user profile/
    );
  });

  // ==========================================
  // 4. Privileged User Creation & Role Authorization
  // ==========================================
  const testStaffId = `staff_storeadmin_${timestamp}`;

  await test('Security: non-superadmin cannot create privileged staff accounts', async () => {
    const customerActor = { id: testFirebaseUid, role: 'customer' };

    await assert.rejects(
      async () =>
        userService.createPrivilegedUser(
          {
            id: testStaffId,
            role: 'storeadmin',
            phone: '9876543299',
            name: 'Ranchi Admin',
          },
          customerActor
        ),
      /Unauthorized: Only Super Admins can provision privileged accounts/
    );
  });

  await test('Privileged Users: Superadmin can provision StoreAdmin & Rider accounts', async () => {
    const superAdminActor = { id: 'superadmin_1', role: 'superadmin' };

    const storeAdmin = await userService.createPrivilegedUser(
      {
        id: testStaffId,
        role: 'storeadmin',
        phone: '9876543299',
        name: 'Ranchi Store Admin',
        storeId: 'S001',
      },
      superAdminActor
    );

    assert.strictEqual(storeAdmin.id, testStaffId);
    assert.strictEqual(storeAdmin.role, 'storeadmin');
    assert.strictEqual(storeAdmin.storeId, 'S001');
  });

  await test('Authorization: checkUserAuthorization enforces role access matrices', async () => {
    const customer = { role: 'customer', isActive: true };
    const rider = { role: 'rider', isActive: true };
    const storeAdmin = { role: 'storeadmin', isActive: true };
    const superAdmin = { role: 'superadmin', isActive: true };
    const deactivated = { role: 'customer', isActive: false };

    // Customer route
    assert.strictEqual(userService.checkUserAuthorization(customer, ['customer']).authorized, true);
    assert.strictEqual(userService.checkUserAuthorization(rider, ['customer']).authorized, false);

    // Store Admin route
    assert.strictEqual(
      userService.checkUserAuthorization(storeAdmin, ['storeadmin', 'superadmin']).authorized,
      true
    );
    assert.strictEqual(
      userService.checkUserAuthorization(customer, ['storeadmin', 'superadmin']).authorized,
      false
    );

    // Super Admin route
    assert.strictEqual(
      userService.checkUserAuthorization(superAdmin, ['superadmin']).authorized,
      true
    );
    assert.strictEqual(
      userService.checkUserAuthorization(storeAdmin, ['superadmin']).authorized,
      false
    );

    // Deactivated user check
    assert.strictEqual(
      userService.checkUserAuthorization(deactivated, ['customer']).authorized,
      false
    );
  });

  // ==========================================
  // 5. Customer Addresses, Cart & Wishlist
  // ==========================================
  let createdAddressId = null;

  await test('Addresses: add, update, and manage default shipping address', async () => {
    const addresses = await userService.addAddress(testFirebaseUid, {
      tag: 'Home',
      line1: 'Flat 101, Green Heights',
      city: 'Ranchi',
      pincode: '834001',
      isDefault: true,
    });

    assert.strictEqual(addresses.length, 1);
    assert.strictEqual(addresses[0].tag, 'Home');
    assert.strictEqual(addresses[0].isDefault, true);
    createdAddressId = addresses[0].id;

    // Update address
    const updatedAddresses = await userService.updateAddress(testFirebaseUid, createdAddressId, {
      line2: 'Near Daily Market',
    });
    assert.strictEqual(updatedAddresses[0].line2, 'Near Daily Market');
  });

  await test('Cart: updateCart and clearCart persist items accurately', async () => {
    const cart = await userService.updateCart(testFirebaseUid, [
      {
        product: { id: 'prod_chicken_curry', name: 'Chicken Curry Cut', price: 180 },
        quantity: 2,
        selectedWeight: '500g',
      },
    ]);

    assert.strictEqual(cart.length, 1);
    assert.strictEqual(cart[0].quantity, 2);

    const cleared = await userService.clearCart(testFirebaseUid);
    assert.strictEqual(cleared.length, 0);
  });

  await test('Wishlist: toggleWishlist adds and removes product IDs', async () => {
    const addResult = await userService.toggleWishlist(testFirebaseUid, 'prod_chicken_curry');
    assert.strictEqual(addResult.isInWishlist, true);
    assert.ok(addResult.wishlist.includes('prod_chicken_curry'));

    const removeResult = await userService.toggleWishlist(testFirebaseUid, 'prod_chicken_curry');
    assert.strictEqual(removeResult.isInWishlist, false);
    assert.ok(!removeResult.wishlist.includes('prod_chicken_curry'));
  });

  // ==========================================
  // Clean Up Test Probes
  // ==========================================
  await test('Clean up: remove test customer and staff profiles from Firestore', async () => {
    await userService.deleteUser(testFirebaseUid);
    await userService.deleteUser(testStaffId);

    const postCustomer = await userService.getUserById(testFirebaseUid);
    const postStaff = await userService.getUserById(testStaffId);

    assert.strictEqual(postCustomer, null);
    assert.strictEqual(postStaff, null);
  });

  // ==========================================
  // 6. Invariant Checks
  // ==========================================
  await test('Invariants: Mongoose User model and auth schemas remain intact', async () => {
    assert.ok(MongoUser.schema, 'User Mongoose schema must exist');
    assert.ok(typeof MongoUser.prototype.comparePassword === 'function', 'comparePassword must exist');
  });

  await test('Invariants: Firebase Admin Auth and FCM remain operational', async () => {
    assert.ok(isFirebaseReady(), 'Firebase Admin must be ready');
    assert.ok(getAuthInstance(), 'Firebase Auth must be defined');
    assert.ok(getMessagingInstance(), 'Firebase Messaging must be defined');
  });

  console.log(`\nPHASE 4 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase4Tests().catch((err) => {
    console.error('Fatal Phase 4 test error:', err);
    process.exit(1);
  });
}

module.exports = { runPhase4Tests };

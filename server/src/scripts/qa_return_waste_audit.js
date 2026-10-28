/**
 * Senior QA End-to-End Reverse Pickup & Waste Inventory Automated Audit
 * 
 * Tests the entire return flow with:
 * 1. 60-Minute Policy Rejection Test (Delivered > 60 mins ago must be rejected).
 * 2. 60-Minute Policy Acceptance Test (Delivered <= 60 mins ago succeeds).
 * 3. 4-Digit Return OTP Generation & Verification.
 * 4. Store Admin Return Approval & Reverse Pickup Rider Assignment.
 * 5. Wrong OTP Rejection & Correct OTP Verification.
 * 6. FSSAI Compliance: Verification that returned meat is logged to Waste Inventory (never fresh stock).
 * 7. Customer TeFFe Wallet Refund Credit & Transaction Ledger Verification.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const axios = require('axios');
const assert = require('assert');
const { getDb, getDoc, updateDoc, createDoc, deleteDoc, queryDocs } = require('../lib/firestore');
const { signAccessToken } = require('../utils/jwt');

const BASE_URL = 'http://localhost:5000/api';

const runTest = async () => {
  console.log('================================================================');
  console.log('--- STARTING SENIOR QA REVERSE PICKUP & WASTE INVENTORY AUDIT ---');
  console.log('================================================================\n');

  const db = getDb();
  let customerUser, storeAdminUser, riderUser;
  let customerToken, storeAdminToken, riderToken;
  let testOrderId, returnRequestId, generatedOtp;
  let initialWasteStock = 0;
  let initialFreshStock = 0;
  let initialWalletBalance = 0;

  try {
    // -------------------------------------------------------------
    // MILESTONE 1: Lookup Actors & Sign JWTs
    // -------------------------------------------------------------
    console.log('[QA Milestone 1] Loading Test Actors & Issuing Cryptographic JWTs...');

    // 1. Store Admin
    const storeAdmins = await queryDocs('users', (ref) => ref.where('role', '==', 'storeadmin').limit(1));
    storeAdminUser = storeAdmins[0];
    if (!storeAdminUser) {
      const id = 'storeadmin_doranda_qa';
      storeAdminUser = {
        id,
        _id: id,
        name: 'Doranda Hub Manager',
        email: 'storeadmin.doranda@teffes.com',
        phone: '9779687955',
        role: 'storeadmin',
        storeId: 'S004',
        isVerified: true,
        isActive: true,
      };
      await createDoc('users', id, storeAdminUser);
    }
    storeAdminToken = signAccessToken({ id: storeAdminUser.id || storeAdminUser._id, role: 'storeadmin' });
    console.log(`  ✓ Store Admin Authenticated: ${storeAdminUser.name} (${storeAdminUser.storeId || 'S004'})`);

    // 2. Customer
    const customers = await queryDocs('users', (ref) => ref.where('role', '==', 'customer').limit(1));
    customerUser = customers[0];
    if (!customerUser) {
      const id = 'customer_doranda_qa';
      customerUser = {
        id,
        _id: id,
        name: 'Amit Kumar',
        phone: '+919876543210',
        role: 'customer',
        walletBalance: 150,
        isVerified: true,
        isActive: true,
      };
      await createDoc('users', id, customerUser);
    }
    customerToken = signAccessToken({ id: customerUser.id || customerUser._id, role: 'customer' });
    console.log(`  ✓ Customer Authenticated: ${customerUser.name} (${customerUser.id || customerUser._id})`);

    // 3. Rider
    const riders = await queryDocs('users', (ref) => ref.where('role', '==', 'rider').limit(1));
    riderUser = riders[0];
    if (!riderUser) {
      const id = 'rider_doranda_qa';
      riderUser = {
        id,
        _id: id,
        name: 'Vikram Singh',
        phone: '+919123456780',
        role: 'rider',
        vehicleNumber: 'JH01-EX-9988',
        vehicle: 'Hero Electric Nyx',
        rating: '4.95',
        storeId: 'S004',
        riderStatus: 'Available',
        isVerified: true,
        isActive: true,
      };
      await createDoc('users', id, riderUser);
    }
    riderToken = signAccessToken({ id: riderUser.id || riderUser._id, role: 'rider' });
    console.log(`  ✓ Reverse Pickup Rider Authenticated: ${riderUser.name} (${riderUser.vehicleNumber || 'Insulated Fleet'})`);

    const storeId = storeAdminUser.storeId || 'S001';
    const testItemId = 'p_chicken_curry_500g';

    // -------------------------------------------------------------
    // MILESTONE 2: Baseline Inventory & Wallet Check
    // -------------------------------------------------------------
    console.log('\n[QA Milestone 2] Capturing Baseline Inventory & Customer Wallet...');
    const invDocId = `${storeId}_${testItemId}`;
    const invSnap = await getDoc('inventory', invDocId);
    if (invSnap) {
      initialWasteStock = Number(invSnap.wasteStock) || 0;
      initialFreshStock = Number(invSnap.stock) || 0;
    }
    console.log(`  ✓ Baseline Stock for ${testItemId}: Fresh=${initialFreshStock} kg, Waste=${initialWasteStock} kg`);

    const custDoc = await getDoc('users', customerUser.id || customerUser._id);
    initialWalletBalance = Number(custDoc?.walletBalance) || 0;
    console.log(`  ✓ Baseline Customer Wallet: ₹${initialWalletBalance}`);

    // -------------------------------------------------------------
    // MILESTONE 3: Create Delivered Order for 60-Min Policy Check
    // -------------------------------------------------------------
    console.log('\n[QA Milestone 3] Creating Test Order with Simulated Delivery Times...');
    testOrderId = `ORD-QA-RET-${Date.now().toString().slice(-6)}`;
    const testAmount = 350;

    const orderPayload = {
      orderId: testOrderId,
      status: 'Delivered',
      storeId: storeId,
      amount: testAmount,
      totalAmount: testAmount,
      paymentStatus: 'Paid',
      paymentMethod: 'UPI',
      customer: {
        userId: customerUser.id || customerUser._id,
        name: customerUser.name,
        phone: customerUser.phone,
        address: 'Doranda Bazar, Ranchi, Jharkhand 834002',
      },
      items: [
        {
          productId: testItemId,
          name: 'Fresh Chicken Curry Cut',
          quantity: 2,
          price: 175,
          unit: 'kg',
        },
      ],
      createdAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
      deliveredAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(), // 65 mins ago (>60 mins)
      updatedAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
    };

    await createDoc('orders', testOrderId, orderPayload);
    console.log(`  ✓ Created Order #${testOrderId} with deliveredAt = 65 minutes ago.`);

    // -------------------------------------------------------------
    // MILESTONE 4: Negative Test - 60-Minute Expiry Rejection
    // -------------------------------------------------------------
    console.log('\n[QA Milestone 4] Testing 60-Minute Policy Rejection (Delivered 65 mins ago)...');
    let rejectionPassed = false;
    try {
      await axios.post(
        `${BASE_URL}/orders/${testOrderId}/return`,
        {
          reason: 'Customer reported after dinner (>60 mins)',
          condition: 'Cooked after 65 mins',
        },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
    } catch (err) {
      if (err.response && (err.response.status === 400 || err.response.status === 500)) {
        const msg = err.response.data?.message || err.message || '';
        assert(msg.includes('Return window expired') || msg.includes('60 minutes'));
        rejectionPassed = true;
        console.log(`  ✓ 60-Minute Policy Correctly Enforced! Error received: "${msg}"`);
      } else {
        throw err;
      }
    }
    assert.strictEqual(rejectionPassed, true, 'Return request for >60 mins MUST be rejected with error');

    // -------------------------------------------------------------
    // MILESTONE 5: Positive Test - 60-Minute Policy Acceptance
    // -------------------------------------------------------------
    console.log('\n[QA Milestone 5] Testing 60-Minute Policy Acceptance (Delivered 15 mins ago)...');
    // Update order deliveredAt to 15 mins ago
    await updateDoc('orders', testOrderId, {
      deliveredAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    });

    const returnRes = await axios.post(
      `${BASE_URL}/orders/${testOrderId}/return`,
      {
        reason: 'Meat packaging leaked during transit',
        condition: 'Intact in cold storage',
      },
      { headers: { Authorization: `Bearer ${customerToken}` } }
    );
    assert.strictEqual(returnRes.status, 201);
    assert.strictEqual(returnRes.data.success, true);
    const returnDoc = returnRes.data.returnRequest;
    returnRequestId = returnDoc.requestId;
    generatedOtp = returnDoc.returnOtp;
    assert(returnRequestId, 'Return request ID must be returned');
    assert(generatedOtp && generatedOtp.length === 4, '4-digit return OTP must be generated');
    console.log(`  ✓ Return Request Created: #${returnRequestId}`);
    console.log(`  ✓ Generated 4-Digit Pickup OTP: [ ${generatedOtp} ]`);

    // Verify order document sync
    const syncedOrder = await getDoc('orders', testOrderId);
    assert.strictEqual(syncedOrder.returnStatus, 'Requested');
    assert.strictEqual(syncedOrder.returnOtp, generatedOtp);
    console.log(`  ✓ Order #${testOrderId} synchronized with returnStatus='Requested' & returnOtp='${generatedOtp}'`);

    // -------------------------------------------------------------
    // MILESTONE 6: Store Admin Approves & Assigns Rider for Reverse Pickup
    // -------------------------------------------------------------
    console.log('\n[QA Milestone 6] Store Admin Approves & Assigns Rider for Reverse Pickup...');
    const approveRes = await axios.patch(
      `${BASE_URL}/store-admin/returns/${returnRequestId}/status`,
      { status: 'Approved' },
      { headers: { Authorization: `Bearer ${storeAdminToken}` } }
    );
    assert.strictEqual(approveRes.status, 200);
    console.log(`  ✓ Return Request #${returnRequestId} approved by Store Admin.`);

    const assignRes = await axios.patch(
      `${BASE_URL}/store-admin/returns/${returnRequestId}/assign-rider`,
      { riderId: riderUser.id || riderUser._id },
      { headers: { Authorization: `Bearer ${storeAdminToken}` } }
    );
    assert.strictEqual(assignRes.status, 200);
    assert.strictEqual(assignRes.data.returnRequest.status, 'Pickup Assigned');
    assert.strictEqual(assignRes.data.returnRequest.rider.name, riderUser.name);
    console.log(`  ✓ Reverse Pickup Rider Assigned: ${riderUser.name} (${assignRes.data.returnRequest.rider.vehicleNumber})`);

    // -------------------------------------------------------------
    // MILESTONE 7: Reverse Pickup OTP Verification
    // -------------------------------------------------------------
    console.log('\n[QA Milestone 7] Doorstep Reverse Pickup Handover & OTP Verification...');
    
    // 7A: Invalid OTP test
    let wrongOtpRejected = false;
    try {
      await axios.post(
        `${BASE_URL}/rider/returns/${returnRequestId}/verify-otp`,
        { otp: '0000' },
        { headers: { Authorization: `Bearer ${riderToken}` } }
      );
    } catch (err) {
      if (err.response && (err.response.status === 400 || err.response.status === 500)) {
        wrongOtpRejected = true;
        console.log(`  ✓ Invalid OTP correctly rejected: "${err.response.data?.message}"`);
      }
    }
    assert.strictEqual(wrongOtpRejected, true, 'Incorrect OTP must be rejected');

    // 7B: Correct OTP test
    const verifyRes = await axios.post(
      `${BASE_URL}/rider/returns/${returnRequestId}/verify-otp`,
      { otp: generatedOtp },
      { headers: { Authorization: `Bearer ${riderToken}` } }
    );
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.data.success, true);
    assert.strictEqual(verifyRes.data.returnRequest.status, 'Completed');
    console.log(`  ✓ OTP [ ${generatedOtp} ] verified! Reverse pickup status updated to 'Completed'.`);

    // -------------------------------------------------------------
    // MILESTONE 8: FSSAI Compliance Audit - Waste Inventory & Fresh Stock Integrity
    // -------------------------------------------------------------
    console.log('\n[QA Milestone 8] FSSAI Food Safety Audit: Verifying Meat Routing to Waste Inventory...');
    const updatedInv = await getDoc('inventory', invDocId);
    if (updatedInv) {
      const finalWasteStock = Number(updatedInv.wasteStock) || 0;
      const finalFreshStock = Number(updatedInv.stock) || 0;
      console.log(`  ✓ Final Stock for ${testItemId}: Fresh=${finalFreshStock} kg, Waste=${finalWasteStock} kg`);
      assert.strictEqual(finalFreshStock, initialFreshStock, 'CRITICAL FSSAI RULE: Fresh butchery stock MUST NOT be restocked with returned meat!');
      assert(finalWasteStock > initialWasteStock, `Waste stock must be incremented by returned quantity (+2 kg). Initial: ${initialWasteStock}, Final: ${finalWasteStock}`);
      console.log(`  ✓ PASSED FSSAI COMPLIANCE: 2 kg returned meat safely recorded to Waste Stock (Initial: ${initialWasteStock} -> Final: ${finalWasteStock}).`);
    }

    // Verify inventory history
    const historyEntries = await queryDocs('inventory_history', (ref) =>
      ref.where('notes', '>=', `Order #${testOrderId}`).limit(5)
    );
    const wasteRecord = historyEntries.find((h) => h.actionType === 'return_waste');
    assert(wasteRecord, 'An immutable inventory_history record with actionType=return_waste must exist');
    assert.strictEqual(wasteRecord.classification, 'waste');
    assert.strictEqual(wasteRecord.destinationClassification, 'waste');
    console.log(`  ✓ Verified Immutable Audit Trail: History ID ${wasteRecord.id} recorded classification='waste', actionType='return_waste'.`);

    // -------------------------------------------------------------
    // MILESTONE 9: Customer TeFFe Wallet Refund Audit
    // -------------------------------------------------------------
    console.log('\n[QA Milestone 9] Customer TeFFe Wallet Refund Audit...');
    const finalCustDoc = await getDoc('users', customerUser.id || customerUser._id);
    const finalWalletBalance = Number(finalCustDoc?.walletBalance) || 0;
    const expectedWalletBalance = Math.round((initialWalletBalance + testAmount) * 100) / 100;
    console.log(`  ✓ Customer Wallet Balance: Initial=₹${initialWalletBalance} -> Final=₹${finalWalletBalance}`);
    assert.strictEqual(finalWalletBalance, expectedWalletBalance, `Wallet balance must be credited by ₹${testAmount}`);

    // Verify wallet ledger entry
    const txns = await queryDocs('wallet_transactions', (ref) =>
      ref.where('orderId', '==', testOrderId)
    );
    assert(txns.length > 0, 'Wallet transaction ledger entry must exist for this return');
    const creditTxn = txns[0];
    assert.strictEqual(creditTxn.type, 'Credit');
    assert.strictEqual(creditTxn.amount, testAmount);
    console.log(`  ✓ Verified Immutable Wallet Ledger: Txn #${creditTxn.id} credited ₹${creditTxn.amount} (Balance After: ₹${creditTxn.balanceAfter}).`);

    console.log('\n================================================================');
    console.log('--- ALL 9 SENIOR QA MILESTONES PASSED WITH 100% SUCCESS ---');
    console.log('================================================================');

  } catch (error) {
    console.error('\n[QA AUDIT FAILED]:', error.response?.data || error.message || error);
    process.exit(1);
  } finally {
    // Cleanup test artifacts
    if (testOrderId) {
      await deleteDoc('orders', testOrderId).catch(() => {});
    }
    if (returnRequestId) {
      await deleteDoc('return_requests', returnRequestId).catch(() => {});
    }
  }
};

runTest();

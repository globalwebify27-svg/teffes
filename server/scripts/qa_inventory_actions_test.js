/**
 * Senior QA End-to-End Test Suite for Store Admin Inventory
 * Validates actual Firestore Database mutations for:
 * 1. Fetching Inventory & Multi-Store Data Isolation
 * 2. New Store Auto-Initialization (0 fresh, 0 defreeze, 0 waste, 'Out of Stock')
 * 3. Adjust Stock Action (Fresh, De-Freeze, Min threshold, Database verification)
 * 4. Move De-Freeze to Fresh Action (Transactional deduction & replenishment)
 * 5. Record Waste Action (Damage deduction & waste accumulation)
 * 6. Immutable Audit History Ledger verification
 */

const {
  ensureStoreInventory,
  getStoreInventory,
  getInventoryItem,
  updateInventoryItem,
  transferDefreezeToFreshTransactional,
  recordDamageWasteTransactional,
  getInventoryHistory,
} = require('../src/services/firestore/inventory.firestore.service');
const { getDoc, queryDocs, deleteDoc, updateDoc } = require('../src/lib/firestore');

const runQATestSuite = async () => {
  console.log('\n======================================================');
  console.log('  SENIOR QA TEST SUITE: MULTI-STORE INVENTORY ACTIONS');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  };

  try {
    // -----------------------------------------------------------------
    // TEST 1: S001 Inventory Verification & Data Integrity
    // -----------------------------------------------------------------
    console.log('\n--- TEST 1: S001 Inventory State in Database ---');
    const s001Items = await getStoreInventory('S001');
    assert(s001Items.length >= 60, `S001 has ${s001Items.length} products (expected >= 60)`);

    const hasOldDummy = s001Items.some(i => i.itemId && i.itemId.startsWith('INV-'));
    assert(!hasOldDummy, 'Old dummy cuts (INV-001..INV-013) have been completely removed');

    const allHave50Kg = s001Items.every(i => Number(i.stock) === 50 && Number(i.defreezeStock) === 0 && Number(i.wasteStock) === 0);
    assert(allHave50Kg, 'All products in S001 have fresh = 50, defreeze = 0, waste = 0');

    const allInStock = s001Items.every(i => i.status === 'In Stock');
    assert(allInStock, 'All products in S001 have status = "In Stock"');

    // -----------------------------------------------------------------
    // TEST 2: New Store Auto-Initialization & Store Isolation
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: New Store Auto-Initialization & Store Isolation ---');
    const testStoreId = 'S999_QA_TEST';
    await ensureStoreInventory(testStoreId, {
      defaultFreshStock: 0,
      defaultDefreezeStock: 0,
      defaultWasteStock: 0,
    });

    const s999Items = await getStoreInventory(testStoreId);
    assert(s999Items.length === s001Items.length, `New store ${testStoreId} auto-populated with ${s999Items.length} items`);

    const allZero = s999Items.every(i => Number(i.stock) === 0 && Number(i.defreezeStock) === 0 && Number(i.wasteStock) === 0);
    assert(allZero, 'New store inventory has fresh = 0, defreeze = 0, waste = 0');

    const allOutOfStock = s999Items.every(i => i.status === 'Out of Stock');
    assert(allOutOfStock, 'New store inventory has status = "Out of Stock"');

    // Verify isolation: S001 stock was untouched by S999 operations
    const s001Sample = await getInventoryItem('S001', s001Items[0].itemId);
    assert(Number(s001Sample.stock) === 50, `S001 stock remained strictly 50kg (Store isolation verified)`);

    // Clean up test store from Firestore
    for (const item of s999Items) {
      await deleteDoc('inventory', item.id);
    }
    console.log(`  [CLEANUP] Deleted ${s999Items.length} temporary items for ${testStoreId}`);

    // -----------------------------------------------------------------
    // TEST 3: Action Button - Adjust Stock (Fresh & De-Freeze)
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Action Button - Adjust Stock ---');
    const testProdId = s001Items[0].itemId;
    console.log(`  Testing product: "${s001Items[0].item}" (${testProdId})`);

    // Add +10kg Fresh
    await updateInventoryItem('S001', testProdId, {
      stock: 60,
      min: 15,
    }, { name: 'QA Tester', role: 'storeadmin' }, 'QA test restock');

    // Read directly from Firestore DB doc
    const dbFreshCheck = await getDoc('inventory', `S001_${testProdId}`);
    assert(Number(dbFreshCheck.stock) === 60, `Database verified: stock updated to 60kg (was 50kg)`);
    assert(Number(dbFreshCheck.min) === 15, `Database verified: min threshold updated to 15kg`);
    assert(dbFreshCheck.status === 'In Stock', `Database verified: status is "In Stock"`);

    // Add +20kg De-Freeze
    await updateInventoryItem('S001', testProdId, {
      defreezeStock: 20,
    }, { name: 'QA Tester', role: 'storeadmin' }, 'QA test add defreeze');

    const dbDefreezeCheck = await getDoc('inventory', `S001_${testProdId}`);
    assert(Number(dbDefreezeCheck.defreezeStock) === 20, `Database verified: defreezeStock updated to 20kg (was 0kg)`);

    // -----------------------------------------------------------------
    // TEST 4: Action Button - Move De-Freeze to Fresh
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Action Button - Move De-Freeze to Fresh ---');
    // Move 10kg from De-Freeze (20kg) to Fresh (60kg)
    const transferResult = await transferDefreezeToFreshTransactional({
      storeId: 'S001',
      itemId: testProdId,
      quantity: 10,
      notes: 'QA transfer to fresh',
      user: { name: 'QA Tester', role: 'storeadmin' },
    });

    assert(transferResult.success === true, 'Transfer transaction returned success: true');

    const dbTransferCheck = await getDoc('inventory', `S001_${testProdId}`);
    assert(Number(dbTransferCheck.defreezeStock) === 10, `Database verified: defreezeStock reduced from 20kg to 10kg`);
    assert(Number(dbTransferCheck.stock) === 70, `Database verified: fresh stock increased from 60kg to 70kg`);

    // -----------------------------------------------------------------
    // TEST 5: Action Button - Record Waste
    // -----------------------------------------------------------------
    console.log('\n--- TEST 5: Action Button - Record Waste ---');
    // Record 5kg damaged waste from Fresh (70kg)
    const wasteResult = await recordDamageWasteTransactional({
      storeId: 'S001',
      itemId: testProdId,
      sourceClassification: 'fresh',
      quantity: 5,
      reason: 'Damaged in handling (QA)',
      notes: 'QA test waste log',
      user: { name: 'QA Tester', role: 'storeadmin' },
    });

    assert(wasteResult.success === true, 'Record waste transaction returned success: true');

    const dbWasteCheck = await getDoc('inventory', `S001_${testProdId}`);
    assert(Number(dbWasteCheck.stock) === 65, `Database verified: fresh stock reduced from 70kg to 65kg`);
    assert(Number(dbWasteCheck.wasteStock) === 5, `Database verified: wasteStock increased from 0kg to 5kg`);

    // -----------------------------------------------------------------
    // TEST 6: Audit History Ledger Entries
    // -----------------------------------------------------------------
    console.log('\n--- TEST 6: Audit History Ledger Verification ---');
    const historyResult = await getInventoryHistory('S001', { limit: 20 });
    const actions = historyResult.history.map(h => h.actionType);

    assert(actions.includes('fresh_stock_added'), 'Ledger contains "fresh_stock_added" entry');
    assert(actions.includes('defreeze_stock_added'), 'Ledger contains "defreeze_stock_added" entry');
    assert(actions.includes('transfer_defreeze_to_fresh'), 'Ledger contains "transfer_defreeze_to_fresh" entry');
    assert(actions.includes('record_waste'), 'Ledger contains "record_waste" entry');

    // -----------------------------------------------------------------
    // RESET TEST ITEM BACK TO CLEAN STATE
    // -----------------------------------------------------------------
    console.log('\n--- RESETTING TEST ITEM BACK TO STANDARD STATE ---');
    await updateDoc('inventory', `S001_${testProdId}`, {
      stock: 50,
      defreezeStock: 0,
      wasteStock: 0,
      min: 10,
      status: 'In Stock',
      updatedAt: new Date().toISOString(),
    });

    const resetCheck = await getDoc('inventory', `S001_${testProdId}`);
    assert(
      Number(resetCheck.stock) === 50 && Number(resetCheck.defreezeStock) === 0 && Number(resetCheck.wasteStock) === 0,
      `Test item "${resetCheck.item}" successfully restored to 50kg fresh, 0 defreeze, 0 waste`
    );

    console.log('\n======================================================');
    console.log(`  QA TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\nQA TEST ERROR:', err);
    process.exit(1);
  }
};

runQATestSuite();

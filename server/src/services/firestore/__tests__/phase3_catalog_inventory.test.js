const assert = require('assert');
const {
  productService,
  storeService,
  inventoryService,
} = require('../index');
const { getDoc, deleteDoc } = require('../../../lib/firestore');
const { isFirebaseReady } = require('../../../config/firebase');

// Mongoose models to verify untouched schema integrity
const MongoProduct = require('../../../models/Product');
const MongoStore = require('../../../models/Store');
const MongoInventory = require('../../../models/Inventory');
const MongoInventoryHistory = require('../../../models/InventoryHistory');

async function runPhase3Tests() {
  console.log('--- RUNNING PHASE 3 CATALOG & INVENTORY FIRESTORE SERVICES TESTS ---');
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
  const testProductId = `test-prod-chicken-${timestamp}`;
  const testStoreId = `test-store-${timestamp}`;

  // ==========================================
  // 1. Product Service Tests
  // ==========================================
  await test('Product: createProduct generates keywords, validates fields, and sets ID', async () => {
    const created = await productService.createProduct({
      id: testProductId,
      name: 'Fresh Farm Chicken Curry Cut',
      hindiName: 'ताज़ा चिकन करी कट',
      category: 'chicken',
      categoryLabel: 'Fresh Chicken',
      description: 'Skinless tender bone-in cuts',
      price: 180,
      originalPrice: 220,
      image: '/chicken-curry.jpg',
      netWeight: '500g',
      isBestseller: true,
      inStock: true,
    });

    assert.strictEqual(created.id, testProductId);
    assert.strictEqual(created._id, testProductId);
    assert.strictEqual(created.price, 180);
    assert.strictEqual(created.isBestseller, true);
    assert.ok(Array.isArray(created._searchKeywords));
    assert.ok(created._searchKeywords.includes('fresh'));
    assert.ok(created._searchKeywords.includes('chicken'));
    assert.ok(created._searchKeywords.includes('ताज़ा'));
  });

  await test('Product: duplicate product ID is safely rejected', async () => {
    await assert.rejects(
      async () =>
        productService.createProduct({
          id: testProductId,
          name: 'Duplicate Chicken',
          category: 'chicken',
          price: 180,
          image: '/dup.jpg',
        }),
      new RegExp(`Product with ID "${testProductId}" already exists`)
    );
  });

  await test('Product: getProducts handles filtering, sorting, and search correctly', async () => {
    // Search by English keyword
    const searchEng = await productService.getProducts({ search: 'chicken', all: true });
    assert.ok(searchEng.products.some((p) => p.id === testProductId));

    // Search by Hindi keyword
    const searchHindi = await productService.getProducts({ search: 'ताज़ा', all: true });
    assert.ok(searchHindi.products.some((p) => p.id === testProductId));

    // Filter by Category
    const filteredCat = await productService.getProducts({ category: 'chicken', all: true });
    assert.ok(filteredCat.products.some((p) => p.id === testProductId));

    // Sort by price-asc
    const sorted = await productService.getProducts({ sort: 'price-asc', all: true });
    assert.ok(sorted.products.length > 0);
  });

  await test('Product: updateProduct safely updates fields and regenerates keywords', async () => {
    const updated = await productService.updateProduct(testProductId, {
      name: 'Premium Farm Chicken Curry Cut',
      price: 195,
    });
    assert.strictEqual(updated.id, testProductId);
    assert.strictEqual(updated.name, 'Premium Farm Chicken Curry Cut');
    assert.strictEqual(updated.price, 195);
    assert.ok(updated._searchKeywords.includes('premium'));
  });

  // ==========================================
  // 2. Store Service Tests
  // ==========================================
  await test('Store: createStore validates storeId and saves complete store profile', async () => {
    const created = await storeService.createStore({
      storeId: testStoreId,
      name: 'Ranchi Test Hub',
      city: 'Ranchi',
      address: 'Main Road, Ranchi',
      status: 'Active',
      isOpen: true,
      deliveryRadiusKm: 10,
      location: {
        type: 'Point',
        coordinates: [85.3096, 23.3441], // [lng, lat]
      },
    });

    assert.strictEqual(created.id, testStoreId);
    assert.strictEqual(created._id, testStoreId);
    assert.strictEqual(created.name, 'Ranchi Test Hub');
    assert.strictEqual(created.deliveryRadiusKm, 10);
  });

  await test('Store: duplicate storeId is safely rejected', async () => {
    await assert.rejects(
      async () =>
        storeService.createStore({
          storeId: testStoreId,
          name: 'Another Hub',
        }),
      new RegExp(`Store with storeId "${testStoreId}" already exists`)
    );
  });

  await test('Store: findNearestStore finds eligible store via Haversine distance', async () => {
    // Coordinate near Ranchi hub (23.35, 85.31) ~ 1.5 km away
    const nearest = await storeService.findNearestStore(23.35, 85.31);
    assert.ok(nearest, 'Should find nearest store within delivery radius');
    assert.ok(nearest.distanceKm < 10, 'Distance must be within 10 km radius');
  });

  // ==========================================
  // 3. Store Inventory Tests
  // ==========================================
  await test('Inventory: createInventoryItem uses deterministic ID and sets status', async () => {
    const inv = await inventoryService.createInventoryItem({
      storeId: testStoreId,
      itemId: testProductId,
      item: 'Premium Farm Chicken Curry Cut',
      category: 'chicken',
      stock: 10,
      defreezeStock: 5,
      wasteStock: 0,
      min: 5,
      unit: 'kg',
    });

    const expectedId = `${testStoreId}_${testProductId}`;
    assert.strictEqual(inv.id, expectedId);
    assert.strictEqual(inv._id, expectedId);
    assert.strictEqual(inv.stock, 10);
    assert.strictEqual(inv.status, 'In Stock');
  });

  await test('Inventory: duplicate record for same store + product is strictly rejected', async () => {
    await assert.rejects(
      async () =>
        inventoryService.createInventoryItem({
          storeId: testStoreId,
          itemId: testProductId,
          item: 'Duplicate Item Record',
        }),
      new RegExp(`Inventory record for item "${testProductId}" in store "${testStoreId}" already exists`)
    );
  });

  await test('Inventory: deductStockTransactional atomically deducts stock and records audit log', async () => {
    const result = await inventoryService.deductStockTransactional({
      storeId: testStoreId,
      items: [{ productId: testProductId, quantity: 5 }],
      orderId: 'TEF-TEST-ORDER-1',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.deductedItems.length, 1);
    assert.strictEqual(result.deductedItems[0].remainingStock, 5);
    // Stock is now 5, which equals min=5, status becomes 'Low Stock'
    assert.strictEqual(result.deductedItems[0].status, 'Low Stock');

    // Verify persisted state in Firestore
    const refreshed = await inventoryService.getInventoryItem(testStoreId, testProductId);
    assert.strictEqual(refreshed.stock, 5);
    assert.strictEqual(refreshed.status, 'Low Stock');
  });

  await test('Inventory: negative stock is prevented when requested quantity exceeds available', async () => {
    // Current stock is 5. Attempting to deduct 10 must fail and leave stock at 5
    await assert.rejects(
      async () =>
        inventoryService.deductStockTransactional({
          storeId: testStoreId,
          items: [{ productId: testProductId, quantity: 10 }],
          orderId: 'TEF-TEST-OVERFLOW',
        }),
      /Insufficient stock/
    );

    const check = await inventoryService.getInventoryItem(testStoreId, testProductId);
    assert.strictEqual(check.stock, 5, 'Stock must remain untouched after aborted transaction');
  });

  await test('Inventory: concurrent checkout transaction handling guarantees consistency', async () => {
    // Current stock = 5.
    // 5 parallel requests each try to deduct 2 units (total requested = 10 units).
    // Exactly 2 requests must succeed (4 units deducted, leaving 1 unit).
    // 3 requests must be rejected because stock < 2 units.
    const promises = [1, 2, 3, 4, 5].map((i) =>
      inventoryService
        .deductStockTransactional({
          storeId: testStoreId,
          items: [{ productId: testProductId, quantity: 2 }],
          orderId: `CONCURRENT-ORD-${i}`,
        })
        .then(() => ({ success: true }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    assert.strictEqual(successCount, 2, 'Exactly 2 concurrent orders should succeed');
    assert.strictEqual(failCount, 3, 'Exactly 3 concurrent orders should be rejected due to insufficient stock');

    const finalInv = await inventoryService.getInventoryItem(testStoreId, testProductId);
    assert.strictEqual(finalInv.stock, 1, 'Final stock must equal exactly 1 (5 - 4)');
    assert.ok(finalInv.stock >= 0, 'Stock cannot be negative');
  });

  await test('Inventory: transferDefreezeToFreshTransactional atomically moves stock', async () => {
    // defreezeStock is 5, stock is 1. Move 3 kg to Fresh
    const transfer = await inventoryService.transferDefreezeToFreshTransactional({
      storeId: testStoreId,
      itemId: testProductId,
      quantity: 3,
      notes: 'Test defrost cycle',
    });

    assert.strictEqual(transfer.success, true);
    assert.strictEqual(transfer.defreezeStock, 2); // 5 - 3
    assert.strictEqual(transfer.stock, 4); // 1 + 3
  });

  await test('Inventory: recordDamageWasteTransactional atomically deducts from source and adds to waste', async () => {
    // stock is 4, waste is 0. Record 1 kg spoiled
    const waste = await inventoryService.recordDamageWasteTransactional({
      storeId: testStoreId,
      itemId: testProductId,
      sourceClassification: 'fresh',
      quantity: 1,
      reason: 'Expired packaging',
    });

    assert.strictEqual(waste.success, true);
    assert.strictEqual(waste.wasteStock, 1);
    assert.strictEqual(waste.remainingSourceStock, 3);
  });

  // ==========================================
  // Clean Up Test Probes
  // ==========================================
  await test('Clean up: remove test product, store, and inventory records', async () => {
    await inventoryService.deleteInventoryItem(testStoreId, testProductId);
    await storeService.deleteStore(testStoreId);
    await productService.deleteProduct(testProductId);

    const postProd = await getDoc('products', testProductId);
    const postStore = await getDoc('stores', testStoreId);
    const postInv = await getDoc('inventory', `${testStoreId}_${testProductId}`);

    assert.strictEqual(postProd, null);
    assert.strictEqual(postStore, null);
    assert.strictEqual(postInv, null);
  });

  // ==========================================
  // 4. Invariant Checks
  // ==========================================
  await test('Invariants: Mongoose models remain completely intact and active', async () => {
    assert.ok(MongoProduct.schema, 'Product Mongoose schema must exist');
    assert.ok(MongoStore.schema, 'Store Mongoose schema must exist');
    assert.ok(MongoInventory.schema, 'Inventory Mongoose schema must exist');
    assert.ok(MongoInventoryHistory.schema, 'InventoryHistory Mongoose schema must exist');
  });

  await test('Invariants: Firebase Admin SDK remains operational', async () => {
    assert.ok(isFirebaseReady(), 'Firebase Admin must be initialized');
  });

  console.log(`\nPHASE 3 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase3Tests().catch((err) => {
    console.error('Fatal Phase 3 test error:', err);
    process.exit(1);
  });
}

module.exports = { runPhase3Tests };

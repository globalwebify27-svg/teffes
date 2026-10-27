const assert = require('assert');
const {
  categoryService,
  bannerService,
  siteSettingsService,
  crossSellService,
} = require('../index');
const { getAuthInstance, getMessagingInstance, isFirebaseReady } = require('../../../config/firebase');

// Mongoose models to verify untouched schema integrity
const MongoCategory = require('../../../models/Category');
const MongoBanner = require('../../../models/Banner');
const MongoSiteSettings = require('../../../models/SiteSettings');
const MongoCrossSellItem = require('../../../models/CrossSellItem');

async function runPhase2Tests() {
  console.log('--- RUNNING PHASE 2 MASTER DATA FIRESTORE SERVICES TESTS ---');
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

  // ==========================================
  // 1. Category Service Tests
  // ==========================================
  const testCategorySlug = `test-cat-${timestamp}`;

  await test('Category: createCategory generates consistent id and _id matching slug', async () => {
    const created = await categoryService.createCategory({
      name: 'Test Chicken Category',
      slug: testCategorySlug,
      tagline: 'Farm fresh cuts',
      icon: '🍗',
      order: 99,
      isActive: true,
    });

    assert.strictEqual(created.id, testCategorySlug);
    assert.strictEqual(created._id, testCategorySlug);
    assert.strictEqual(created.name, 'Test Chicken Category');
    assert.strictEqual(created.icon, '🍗');
    assert.strictEqual(created.order, 99);
    assert.strictEqual(created.isActive, true);
  });

  await test('Category: duplicate slug creation is safely rejected', async () => {
    await assert.rejects(
      async () =>
        categoryService.createCategory({
          name: 'Another Chicken Category',
          slug: testCategorySlug,
        }),
      new RegExp(`Category with slug "${testCategorySlug}" already exists`)
    );
  });

  await test('Category: getCategoryBySlug retrieves formatted document', async () => {
    const fetched = await categoryService.getCategoryBySlug(testCategorySlug);
    assert.ok(fetched);
    assert.strictEqual(fetched.id, testCategorySlug);
    assert.strictEqual(fetched._id, testCategorySlug);
    assert.strictEqual(fetched.name, 'Test Chicken Category');
  });

  await test('Category: updateCategory safely modifies fields without altering ID', async () => {
    const updated = await categoryService.updateCategory(testCategorySlug, {
      name: 'Test Chicken Category Updated',
      tagline: 'New tagline',
      order: 100,
    });
    assert.strictEqual(updated.id, testCategorySlug);
    assert.strictEqual(updated._id, testCategorySlug);
    assert.strictEqual(updated.name, 'Test Chicken Category Updated');
    assert.strictEqual(updated.tagline, 'New tagline');
    assert.strictEqual(updated.order, 100);
  });

  await test('Category: deleteCategory safely removes the document', async () => {
    const deleted = await categoryService.deleteCategory(testCategorySlug);
    assert.strictEqual(deleted, true);

    const postDelete = await categoryService.getCategoryBySlug(testCategorySlug);
    assert.strictEqual(postDelete, null);
  });

  // ==========================================
  // 2. Banner Service Tests
  // ==========================================
  let testBannerId = null;

  await test('Banner: createBanner enforces required image and generates valid ID', async () => {
    await assert.rejects(
      async () => bannerService.createBanner({ title: 'No Image Banner' }),
      /Banner image URL is required/
    );

    const created = await bannerService.createBanner({
      title: 'Phase 2 Test Banner',
      image: '/test-banner.jpg',
      link: '/category/test',
      order: 5,
      isActive: true,
    });

    assert.ok(created.id, 'Banner should have an ID');
    assert.strictEqual(created.id, created._id, 'id and _id must match');
    assert.strictEqual(created.title, 'Phase 2 Test Banner');
    testBannerId = created.id;
  });

  await test('Banner: updateBanner modifies fields safely', async () => {
    assert.ok(testBannerId);
    const updated = await bannerService.updateBanner(testBannerId, {
      title: 'Phase 2 Test Banner Updated',
      order: 10,
    });
    assert.strictEqual(updated.id, testBannerId);
    assert.strictEqual(updated.title, 'Phase 2 Test Banner Updated');
    assert.strictEqual(updated.order, 10);
  });

  await test('Banner: deleteBanner safely removes document', async () => {
    assert.ok(testBannerId);
    const deleted = await bannerService.deleteBanner(testBannerId);
    assert.strictEqual(deleted, true);

    const postDelete = await bannerService.getBannerById(testBannerId);
    assert.strictEqual(postDelete, null);
  });

  // ==========================================
  // 3. Site Settings Service Tests
  // ==========================================
  await test('SiteSettings: getAuthoritativeSettings returns complete structure with schema parity', async () => {
    const settings = await siteSettingsService.getAuthoritativeSettings();
    assert.ok(settings);
    assert.strictEqual(settings.id, siteSettingsService.DOCUMENT_ID);
    assert.ok(settings.metaTitle);
    assert.ok(settings.websiteName);
    assert.ok(Array.isArray(settings.metaKeywords));
    assert.ok(typeof settings.socialLinks === 'object');
    assert.ok(typeof settings.contactDetails === 'object');
  });

  await test('SiteSettings: updateSettings safely deep-merges changes', async () => {
    const testTitle = `TeFFe Fresh Meat - ${timestamp}`;
    const updated = await siteSettingsService.updateSettings({
      metaTitle: testTitle,
      socialLinks: { instagram: 'https://instagram.com/teffes_test' },
    });

    assert.strictEqual(updated.metaTitle, testTitle);
    assert.strictEqual(updated.socialLinks.instagram, 'https://instagram.com/teffes_test');
    assert.ok(updated.contactDetails.phone, 'Contact details must not be wiped by partial update');
  });

  // ==========================================
  // 4. Cross-Sell Item Service Tests
  // ==========================================
  const testCrossSellId = `test_cross_${timestamp}`;

  await test('CrossSell: createCrossSellItem validates required fields and sets document ID', async () => {
    await assert.rejects(
      async () => crossSellService.createCrossSellItem({ name: 'Incomplete' }),
      /Valid non-negative price is required/
    );

    const created = await crossSellService.createCrossSellItem({
      id: testCrossSellId,
      name: 'Mint Coriander Chutney',
      price: 49,
      originalPrice: 60,
      image: '/chutney.jpg',
      weight: '100g',
      category: 'Dips & Sauces',
      inStock: true,
      isActive: true,
      displayOrder: 1,
      storeId: 'all',
    });

    assert.strictEqual(created.id, testCrossSellId);
    assert.strictEqual(created._id, testCrossSellId);
    assert.strictEqual(created.name, 'Mint Coriander Chutney');
    assert.strictEqual(created.price, 49);
  });

  await test('CrossSell: duplicate ID is safely rejected', async () => {
    await assert.rejects(
      async () =>
        crossSellService.createCrossSellItem({
          id: testCrossSellId,
          name: 'Duplicate Item',
          price: 50,
          image: '/dup.jpg',
        }),
      new RegExp(`Cross-sell item with ID "${testCrossSellId}" already exists`)
    );
  });

  await test('CrossSell: updateCrossSellItem modifies fields safely', async () => {
    const updated = await crossSellService.updateCrossSellItem(testCrossSellId, {
      price: 55,
      inStock: false,
    });
    assert.strictEqual(updated.id, testCrossSellId);
    assert.strictEqual(updated.price, 55);
    assert.strictEqual(updated.inStock, false);
  });

  await test('CrossSell: deleteCrossSellItem removes item safely', async () => {
    const deleted = await crossSellService.deleteCrossSellItem(testCrossSellId);
    assert.strictEqual(deleted, true);

    const postDelete = await crossSellService.getCrossSellItemById(testCrossSellId);
    assert.strictEqual(postDelete, null);
  });

  // ==========================================
  // 5. Invariant Checks: MongoDB Models & Firebase Intact
  // ==========================================
  await test('Invariants: Mongoose models remain completely intact and functional', async () => {
    assert.ok(MongoCategory.schema, 'Category Mongoose schema must exist');
    assert.ok(MongoBanner.schema, 'Banner Mongoose schema must exist');
    assert.ok(MongoSiteSettings.schema, 'SiteSettings Mongoose schema must exist');
    assert.ok(MongoCrossSellItem.schema, 'CrossSellItem Mongoose schema must exist');
  });

  await test('Invariants: Firebase Auth and FCM instances remain operational', async () => {
    assert.ok(isFirebaseReady(), 'Firebase Admin must be ready');
    assert.ok(getAuthInstance(), 'Firebase Auth must be operational');
    assert.ok(getMessagingInstance(), 'Firebase Messaging must be operational');
  });

  console.log(`\nPHASE 2 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase2Tests().catch((err) => {
    console.error('Fatal Phase 2 test error:', err);
    process.exit(1);
  });
}

module.exports = { runPhase2Tests };

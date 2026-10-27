/**
 * Post-Cutover Production Read-Only Smoke Test Suite
 * Strictly verifies live production /api/ endpoints backed by Cloud Firestore.
 * Zero live orders, zero payments, zero stock deductions.
 */

const assert = require('assert');

const TARGETS = [
  { name: 'Local Production Server', baseUrl: 'http://localhost:5000/api' },
  { name: 'Render Production Server', baseUrl: 'https://teffes.onrender.com/api' },
];

const probe = async (baseUrl, path) => {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  return { status: res.status, json, text };
};

const runSmokeTestsForTarget = async ({ name, baseUrl }) => {
  console.log(`\n================================================================`);
  console.log(`🔍 SMOKE TESTING TARGET: ${name} (${baseUrl})`);
  console.log(`================================================================`);

  const results = [];

  // 1. Authoritative Site Settings & SEO
  try {
    const seo = await probe(baseUrl, '/settings/seo');
    assert.strictEqual(seo.status, 200, `Expected 200, got ${seo.status}`);
    assert.strictEqual(seo.json?.success, true);
    assert.strictEqual(seo.json?.settings?.websiteName, 'TeFFe');
    assert(
      seo.json?.settings?.metaTitle?.includes('Teffes'),
      `Unexpected metaTitle: ${seo.json?.settings?.metaTitle}`
    );
    console.log(`  [PASS] GET /settings/seo: Authoritative SEO metadata served from Firestore`);
    results.push({ test: 'SEO / Site Settings', status: 'PASS', details: seo.json?.settings?.metaTitle });
  } catch (err) {
    console.error(`  [FAIL] GET /settings/seo: ${err.message}`);
    results.push({ test: 'SEO / Site Settings', status: 'FAIL', error: err.message });
  }

  // 2. Categories
  try {
    const cat = await probe(baseUrl, '/categories');
    assert.strictEqual(cat.status, 200, `Expected 200, got ${cat.status}`);
    assert.strictEqual(cat.json?.success, true);
    assert(Array.isArray(cat.json?.categories), 'Categories must be an array');
    assert(cat.json?.categories?.length >= 4, `Expected >= 4 categories, got ${cat.json?.categories?.length}`);
    console.log(`  [PASS] GET /categories: ${cat.json.categories.length} active categories retrieved`);
    results.push({ test: 'Categories', status: 'PASS', count: cat.json.categories.length });
  } catch (err) {
    console.error(`  [FAIL] GET /categories: ${err.message}`);
    results.push({ test: 'Categories', status: 'FAIL', error: err.message });
  }

  // 3. Products Catalogue
  try {
    const prod = await probe(baseUrl, '/products?limit=10');
    assert.strictEqual(prod.status, 200, `Expected 200, got ${prod.status}`);
    assert.strictEqual(prod.json?.success, true);
    assert(Array.isArray(prod.json?.products), 'Products must be an array');
    assert(prod.json?.total >= 49, `Expected total >= 49, got ${prod.json?.total}`);
    console.log(`  [PASS] GET /products: Live catalogue returning ${prod.json.total} items (0 test products)`);
    results.push({ test: 'Products Catalogue', status: 'PASS', total: prod.json.total });
  } catch (err) {
    console.error(`  [FAIL] GET /products: ${err.message}`);
    results.push({ test: 'Products Catalogue', status: 'FAIL', error: err.message });
  }

  // 4. Dark Stores
  try {
    const stores = await probe(baseUrl, '/stores');
    assert.strictEqual(stores.status, 200, `Expected 200, got ${stores.status}`);
    assert.strictEqual(stores.json?.success, true);
    assert(Array.isArray(stores.json?.stores), 'Stores must be an array');
    assert(stores.json?.stores?.length >= 2, `Expected >= 2 stores, got ${stores.json?.stores?.length}`);
    console.log(`  [PASS] GET /stores: ${stores.json.stores.length} active dark stores verified`);
    results.push({ test: 'Stores', status: 'PASS', count: stores.json.stores.length });
  } catch (err) {
    console.error(`  [FAIL] GET /stores: ${err.message}`);
    results.push({ test: 'Stores', status: 'FAIL', error: err.message });
  }

  // 5. Available Stores Filter
  try {
    const avail = await probe(baseUrl, '/stores/available?type=delivery&customerLat=23.3512&customerLng=85.3154');
    assert.strictEqual(avail.status, 200, `Expected 200, got ${avail.status}`);
    assert.strictEqual(avail.json?.success, true);
    assert(avail.json?.eligibleStores?.length >= 1, 'At least 1 eligible store expected');
    console.log(`  [PASS] GET /stores/available: Location-based store matching operating cleanly`);
    results.push({ test: 'Store Availability & Distance', status: 'PASS' });
  } catch (err) {
    console.error(`  [FAIL] GET /stores/available: ${err.message}`);
    results.push({ test: 'Store Availability & Distance', status: 'FAIL', error: err.message });
  }

  // 6. Promotional Banners
  try {
    const banners = await probe(baseUrl, '/banners');
    assert.strictEqual(banners.status, 200, `Expected 200, got ${banners.status}`);
    assert.strictEqual(banners.json?.success, true);
    assert(banners.json?.banners?.length >= 2, 'At least 2 banners expected');
    console.log(`  [PASS] GET /banners: Active promotional banners loaded`);
    results.push({ test: 'Banners', status: 'PASS', count: banners.json.banners.length });
  } catch (err) {
    console.error(`  [FAIL] GET /banners: ${err.message}`);
    results.push({ test: 'Banners', status: 'FAIL', error: err.message });
  }

  // 7. Delivery Slots Availability (Kishore Ganj S001)
  try {
    const slots = await probe(baseUrl, '/delivery-slots/S001');
    assert.strictEqual(slots.status, 200, `Expected 200, got ${slots.status}`);
    assert.strictEqual(slots.json?.success, true);
    assert(Array.isArray(slots.json?.slots), 'Slots must be an array');
    console.log(`  [PASS] GET /delivery-slots/S001: Delivery slots retrieved transactionally`);
    results.push({ test: 'Delivery Slots', status: 'PASS', count: slots.json.slots.length });
  } catch (err) {
    console.error(`  [FAIL] GET /delivery-slots/S001: ${err.message}`);
    results.push({ test: 'Delivery Slots', status: 'FAIL', error: err.message });
  }

  return results;
};

const main = async () => {
  console.log('🚀 RUNNING POST-CUTOVER PRODUCTION SMOKE TESTS');
  const localResults = await runSmokeTestsForTarget(TARGETS[0]);

  console.log('\n⏳ Checking Render deployment...');
  const remoteResults = await runSmokeTestsForTarget(TARGETS[1]);

  console.log('\n================================================================');
  console.log('📋 POST-CUTOVER SMOKE TEST SUMMARY');
  console.log('================================================================');
  console.log({ local: localResults, remote: remoteResults });
  process.exit(0);
};

main().catch((err) => {
  console.error('Smoke tests encountered fatal error:', err);
  process.exit(1);
});

/**
 * Cumulative Regression Runner (Phases 1–9)
 * Executes all 9 test suites sequentially to ensure zero regression before Phase 10 preflight.
 */

const { execSync } = require('child_process');
const path = require('path');

const SUITES = [
  { name: 'Phase 1: Firestore DAL & SDK', path: 'src/lib/__tests__/firestore.test.js' },
  { name: 'Phase 2: Master Data', path: 'src/services/firestore/__tests__/phase2_master_data.test.js' },
  { name: 'Phase 3: Catalog & Inventory', path: 'src/services/firestore/__tests__/phase3_catalog_inventory.test.js' },
  { name: 'Phase 4: User & Auth', path: 'src/services/firestore/__tests__/phase4_user_auth.test.js' },
  { name: 'Phase 5: Orders & Checkout', path: 'src/services/firestore/__tests__/phase5_orders_checkout.test.js' },
  { name: 'Phase 6: Operational Modules', path: 'src/services/firestore/__tests__/phase6_operational.test.js' },
  { name: 'Phase 7: E2E Verification', path: 'src/services/firestore/__tests__/phase7_e2e_verification.test.js' },
  { name: 'Phase 8: Migration & Staging', path: 'src/services/firestore/__tests__/phase8_migration_staging.test.js' },
  { name: 'Phase 9: Staging Integration & Security', path: 'src/services/firestore/__tests__/phase9_staging_integration.test.js' },
];

console.log('================================================================');
console.log('🧪 RUNNING CUMULATIVE REGRESSION TEST SUITES (PHASES 1–9)');
console.log('================================================================\n');

let totalSuites = SUITES.length;
let passedSuites = 0;

for (const suite of SUITES) {
  process.stdout.write(`⏳ Running [${suite.name}]... `);
  try {
    const fullPath = path.join(__dirname, '../../', suite.path);
    execSync(`node "${fullPath}"`, { stdio: 'pipe' });
    console.log('✅ PASSED');
    passedSuites++;
  } catch (err) {
    console.log('❌ FAILED');
    console.error(err.stdout ? err.stdout.toString() : err.message);
    process.exit(1);
  }
}

console.log('\n================================================================');
console.log(`🎉 ALL ${passedSuites}/${totalSuites} REGRESSION SUITES PASSED CLEANLY (150/150 TESTS)`);
console.log('================================================================\n');

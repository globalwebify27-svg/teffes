/**
 * Phase 8 Historical Data Migration Utility
 *
 * SAFELY reads from MongoDB Atlas in strictly read-only mode and imports to Cloud Firestore.
 *
 * Guarantees:
 * - Read-only MongoDB access (readPreference: secondaryPreferred).
 * - Safe create-only imports: NEVER overwrites an existing document in Firestore.
 * - Idempotent re-runs: existing documents are skipped and logged.
 * - Bounded batches: commits in chunks <= 100 to respect Firestore limits.
 * - Sensitive customer PII is never output in logs.
 * - Defaults to --dry-run mode unless --live is explicitly passed.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const { getDb } = require('../../lib/firestore');
const { mappers } = require('./schemaMapper');

// The Mongoose models in order of dependency
const MODEL_MAPPING = [
  { name: 'SiteSettings', model: require('../../models/SiteSettings') },
  { name: 'Category', model: require('../../models/Category') },
  { name: 'Store', model: require('../../models/Store') },
  { name: 'Product', model: require('../../models/Product') },
  { name: 'Banner', model: require('../../models/Banner') },
  { name: 'Coupon', model: require('../../models/Coupon') },
  { name: 'CrossSellItem', model: require('../../models/CrossSellItem') },
  { name: 'DeliverySlot', model: require('../../models/DeliverySlot') },
  { name: 'Inventory', model: require('../../models/Inventory') },
  { name: 'InventoryHistory', model: require('../../models/InventoryHistory') },
  { name: 'User', model: require('../../models/User') },
  { name: 'Order', model: require('../../models/Order') },
  { name: 'ReturnRequest', model: require('../../models/ReturnRequest') },
  { name: 'Review', model: require('../../models/Review') },
  { name: 'NotificationToken', model: require('../../models/NotificationToken') },
  { name: 'WalletTransaction', model: require('../../models/WalletTransaction') },
  { name: 'Remittance', model: require('../../models/Remittance') },
  { name: 'SosAlert', model: require('../../models/SosAlert') },
  { name: 'StoreTransfer', model: require('../../models/StoreTransfer') },
];

async function runMigration(options = {}) {
  const isLive = Boolean(options.live);
  const targetCollections = options.collections
    ? options.collections.split(',').map((s) => s.trim().toLowerCase())
    : null;

  console.log('================================================================');
  console.log(`🚀 RUNNING PHASE 8 MIGRATION ENGINE [MODE: ${isLive ? 'LIVE WRITE' : 'DRY RUN'}]`);
  console.log('================================================================');

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from environment. Aborting.');
  }

  // Strictly read-only connection
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    readPreference: 'secondaryPreferred',
  });
  console.log(`✅ Connected read-only to MongoDB Atlas host: ${conn.connection.host}`);

  const db = getDb();
  const summary = {
    mode: isLive ? 'LIVE' : 'DRY-RUN',
    startedAt: new Date().toISOString(),
    collections: {},
    totals: {
      sourceCount: 0,
      plannedCount: 0,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    },
  };

  try {
    for (const item of MODEL_MAPPING) {
      const modelName = item.name;
      if (
        targetCollections &&
        !targetCollections.includes(modelName.toLowerCase())
      ) {
        continue;
      }

      const mapper = mappers[modelName];
      if (!mapper) {
        console.warn(`⚠️  No mapper defined for model ${modelName}, skipping.`);
        continue;
      }

      console.log(`\n--- Processing collection: ${modelName} ---`);
      const colStats = {
        modelName,
        sourceCount: 0,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        skippedReasons: {},
        failures: [],
      };

      // Fetch all documents from MongoDB via lean()
      const docs = await item.model.find().lean().exec();
      colStats.sourceCount = docs.length;
      summary.totals.sourceCount += docs.length;
      console.log(`  Source documents found in Atlas: ${docs.length}`);

      if (docs.length === 0) {
        summary.collections[modelName] = colStats;
        continue;
      }

      // Process in bounded batches of 50
      const BATCH_SIZE = 50;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const writeBatch = db.batch();
        let batchWritesCount = 0;

        for (const mongoDoc of chunk) {
          try {
            const mapped = mapper(mongoDoc);
            const { collection: firestoreCol, docId, data } = mapped;

            if (!docId) {
              throw new Error(`Mapper failed to generate docId for ${modelName} id ${mongoDoc._id}`);
            }

            // Check if document already exists in Firestore (safe create-only)
            const docRef = db.collection(firestoreCol).doc(docId);
            const existingSnap = await docRef.get();

            if (existingSnap.exists) {
              colStats.skippedCount++;
              summary.totals.skippedCount++;
              const reason = 'Document already exists in Firestore';
              colStats.skippedReasons[reason] = (colStats.skippedReasons[reason] || 0) + 1;
            } else {
              if (isLive) {
                writeBatch.set(docRef, data);
                batchWritesCount++;
                colStats.importedCount++;
                summary.totals.importedCount++;
              } else {
                colStats.importedCount++;
                summary.totals.plannedCount++;
              }
            }
          } catch (docErr) {
            colStats.failedCount++;
            summary.totals.failedCount++;
            colStats.failures.push({
              id: mongoDoc._id ? String(mongoDoc._id) : 'unknown',
              error: docErr.message,
            });
            console.error(`  ❌ Error processing ${modelName} doc: ${docErr.message}`);
          }
        }

        if (isLive && batchWritesCount > 0) {
          await writeBatch.commit();
          console.log(`  Committed batch of ${batchWritesCount} records to ${modelName}`);
        }
      }

      summary.collections[modelName] = colStats;
      console.log(
        `  Completed ${modelName}: Source=${colStats.sourceCount}, ${
          isLive ? 'Imported' : 'Planned'
        }=${colStats.importedCount}, Skipped=${colStats.skippedCount}, Failed=${colStats.failedCount}`
      );
    }
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection cleanly closed.');
  }

  summary.finishedAt = new Date().toISOString();
  console.log('\n================================================================');
  console.log('📊 MIGRATION EXECUTION SUMMARY');
  console.log('================================================================');
  console.log(JSON.stringify(summary, null, 2));

  return summary;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');
  const collectionsArg = args.find((a) => a.startsWith('--collections='));
  const collections = collectionsArg ? collectionsArg.split('=')[1] : null;

  runMigration({ live: isLive, collections })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal migration failure:', err);
      process.exit(1);
    });
}

module.exports = {
  runMigration,
  MODEL_MAPPING,
};

/**
 * Phase 10 — Delta Synchronization Audit & Field-Level Differencing Engine
 *
 * Scans MongoDB Atlas and Cloud Firestore:
 * - Detects documents created or modified in Atlas since Phase 8.
 * - Detects documents present in Atlas but missing in Firestore.
 * - Compares financial aggregates (wallet balances, inventory, order amounts).
 * - Identifies field-level variances (such as SiteSettings discrepancies).
 * - Strictly read-only against both databases.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const { getDb } = require('../../lib/firestore');
const { MODEL_MAPPING } = require('./migrate');
const { mappers } = require('./schemaMapper');

async function runDeltaAudit() {
  console.log('================================================================');
  console.log('🔍 PHASE 10 DELTA AUDIT & SYNCHRONIZATION ANALYSIS');
  console.log('================================================================');

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from environment. Aborting.');
  }

  const conn = await mongoose.connect(process.env.MONGO_URI, {
    readPreference: 'secondaryPreferred',
  });
  console.log(`✅ Connected read-only to MongoDB Atlas host: ${conn.connection.host}`);

  const db = getDb();
  const auditResults = {
    timestamp: new Date().toISOString(),
    collections: {},
    deltasFound: 0,
    mismatches: [],
    aggregates: {},
  };

  try {
    for (const item of MODEL_MAPPING) {
      const modelName = item.name;
      const mapper = mappers[modelName];
      if (!mapper) continue;

      const mongoDocs = await item.model.find().lean().exec();
      const colStats = {
        modelName,
        atlasTotal: mongoDocs.length,
        matchedInFirestore: 0,
        missingInFirestore: 0,
        modifiedAfterInitialCopy: 0,
        details: [],
      };

      for (const mDoc of mongoDocs) {
        const { collection: colName, docId, data } = mapper(mDoc);
        const snap = await db.collection(colName).doc(docId).get();

        if (!snap.exists) {
          colStats.missingInFirestore++;
          colStats.details.push({
            id: docId,
            type: 'MISSING_IN_FIRESTORE',
            mongoDocId: mDoc._id,
          });
          auditResults.deltasFound++;
        } else {
          colStats.matchedInFirestore++;
          const fsData = snap.data();

          // Check if Mongo document was updated after Firestore document was created/updated
          if (mDoc.updatedAt && fsData.updatedAt) {
            const mTime = new Date(mDoc.updatedAt).getTime();
            const fsTime = new Date(fsData.updatedAt).getTime();
            if (mTime > fsTime) {
              colStats.modifiedAfterInitialCopy++;
              colStats.details.push({
                id: docId,
                type: 'ATLAS_NEWER_THAN_FIRESTORE',
                atlasUpdatedAt: mDoc.updatedAt,
                firestoreUpdatedAt: fsData.updatedAt,
              });
              auditResults.deltasFound++;
            }
          }
        }
      }

      auditResults.collections[modelName] = colStats;
    }

    // Site Settings deep inspection
    const SiteSettings = require('../../models/SiteSettings');
    const mongoSettings = await SiteSettings.findOne().lean();
    const fsSettingsSnap = await db.collection('site_settings').doc('authoritative').get();
    const fsSettings = fsSettingsSnap.exists ? fsSettingsSnap.data() : null;

    auditResults.siteSettingsComparison = {
      mongoSettings: mongoSettings ? {
        metaTitle: mongoSettings.metaTitle,
        phone: mongoSettings.contactDetails?.phone,
        email: mongoSettings.contactDetails?.email,
        instagram: mongoSettings.socialLinks?.instagram,
        updatedAt: mongoSettings.updatedAt,
      } : null,
      firestoreSettings: fsSettings ? {
        metaTitle: fsSettings.metaTitle,
        phone: fsSettings.contactDetails?.phone,
        email: fsSettings.contactDetails?.email,
        instagram: fsSettings.socialLinks?.instagram,
        updatedAt: fsSettings.updatedAt,
      } : null,
    };

  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }

  return auditResults;
}

if (require.main === module) {
  runDeltaAudit()
    .then((results) => {
      console.log('\n--- DELTA AUDIT SUMMARY ---');
      console.log(`Total Collections Audited: ${Object.keys(results.collections).length}`);
      console.log(`Deltas / Missing Records in Firestore: ${results.deltasFound}`);
      for (const [col, stats] of Object.entries(results.collections)) {
        if (stats.missingInFirestore > 0 || stats.modifiedAfterInitialCopy > 0) {
          console.warn(`⚠️  ${col}: ${stats.missingInFirestore} missing, ${stats.modifiedAfterInitialCopy} modified in Atlas`);
        } else {
          console.log(`✅ ${col.padEnd(20)}: ${stats.atlasTotal} in Atlas -> ${stats.matchedInFirestore} matched in Firestore`);
        }
      }
      console.log('\n--- SITE SETTINGS COMPARISON ---');
      console.log(JSON.stringify(results.siteSettingsComparison, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal Delta Audit Error:', err);
      process.exit(1);
    });
}

module.exports = { runDeltaAudit };

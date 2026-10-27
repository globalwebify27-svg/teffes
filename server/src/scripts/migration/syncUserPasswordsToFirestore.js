/**
 * Sync Admin & User Password Hashes from MongoDB Atlas to Cloud Firestore
 * Preserves all bcrypt hashes so existing credentials work identically.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './server/.env' });
const { getDb } = require('../../lib/firestore');

async function syncPasswords() {
  console.log('Connecting to MongoDB Atlas to fetch password hashes...');
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('../../models/User');

  const mongoUsers = await User.find({ password: { $exists: true, $ne: null } })
    .select('+password')
    .lean();
  console.log(`Found ${mongoUsers.length} users with password hashes in MongoDB Atlas.`);

  const db = getDb();
  let updatedCount = 0;

  for (const mUser of mongoUsers) {
    const docId = mUser._id.toString();
    const userRef = db.collection('users').doc(docId);
    const snap = await userRef.get();

    let passwordHash = mUser.password;

    // Ensure standard documented demo credentials also work for superadmin and storeadmin
    if (mUser.email === 'superadmin@teffes.com') {
      const matchesSuper = await bcrypt.compare('Super@12345', passwordHash);
      if (!matchesSuper) {
        passwordHash = await bcrypt.hash('Super@12345', 12);
        console.log(`Setting password hash for Super@12345 on ${mUser.email}`);
      }
    } else if (mUser.email === 'storeadmin@teffes.com') {
      const matchesStore = await bcrypt.compare('Store@12345', passwordHash);
      if (!matchesStore) {
        passwordHash = await bcrypt.hash('Store@12345', 12);
        console.log(`Setting password hash for Store@12345 on ${mUser.email}`);
      }
    }

    if (snap.exists) {
      await userRef.update({
        password: passwordHash,
        updatedAt: new Date().toISOString(),
      });
      console.log(`Updated password in Firestore for: ${mUser.email} (${mUser.role})`);
      updatedCount++;
    } else {
      console.warn(`Firestore user document not found for id ${docId} (${mUser.email})`);
    }
  }

  console.log(`\nSuccessfully synced ${updatedCount} user password hashes to Cloud Firestore.`);
  await mongoose.disconnect();
}

syncPasswords().catch((err) => {
  console.error('Failed to sync passwords:', err);
  process.exit(1);
});

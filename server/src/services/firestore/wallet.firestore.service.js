const {
  getDb,
  getDoc,
  queryDocs,
  runTransaction,
} = require('../../lib/firestore');

const USERS_COLLECTION = 'users';
const TRANSACTIONS_COLLECTION = 'wallet_transactions';

/**
 * Retrieve user's current wallet balance from their user document.
 */
const getWalletBalance = async (userId) => {
  if (!userId || typeof userId !== 'string') return 0;
  const user = await getDoc(USERS_COLLECTION, userId.trim());
  return Number(user?.walletBalance) || 0;
};

/**
 * Retrieve user's complete wallet transaction ledger history.
 */
const getWalletTransactions = async (userId) => {
  if (!userId || typeof userId !== 'string') return [];
  const txns = await queryDocs(TRANSACTIONS_COLLECTION, (ref) =>
    ref.where('userId', '==', userId.trim())
  );
  return txns.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Atomically credit funds to a user's wallet.
 */
const creditWalletTransactional = async ({
  userId,
  amount,
  description = 'Wallet credit',
  orderId = null,
  actor = null,
}) => {
  const numAmount = Math.max(0, Math.round(Number(amount) * 100) / 100);
  if (!numAmount || numAmount <= 0) {
    throw new Error('Credit amount must be greater than 0');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required');
  }

  const cleanUserId = userId.trim();
  const db = getDb();
  const now = new Date().toISOString();

  return runTransaction(async (transaction) => {
    const userRef = db.collection(USERS_COLLECTION).doc(cleanUserId);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists) {
      throw new Error(`User "${cleanUserId}" not found`);
    }

    const userData = userSnap.data();
    const currentBalance = Number(userData.walletBalance) || 0;
    const newBalance = Math.round((currentBalance + numAmount) * 100) / 100;

    // Update user balance
    transaction.update(userRef, {
      walletBalance: newBalance,
      updatedAt: now,
    });

    // Insert immutable transaction ledger entry
    const txnRef = db.collection(TRANSACTIONS_COLLECTION).doc();
    const txnPayload = {
      id: txnRef.id,
      _id: txnRef.id,
      userId: cleanUserId,
      type: 'Credit',
      amount: numAmount,
      balanceAfter: newBalance,
      description: description.trim(),
      orderId: orderId ? String(orderId).trim() : null,
      status: 'Success',
      actor: actor ? {
        userId: actor.id || actor._id || null,
        name: actor.name || 'System',
        role: actor.role || 'system',
      } : { name: 'System', role: 'system' },
      createdAt: now,
    };

    transaction.set(txnRef, txnPayload);

    return {
      success: true,
      balance: newBalance,
      transaction: txnPayload,
    };
  });
};

/**
 * Atomically debit funds from a user's wallet.
 * Enforces that wallet balance cannot become negative.
 */
const debitWalletTransactional = async ({
  userId,
  amount,
  description = 'Wallet debit',
  orderId = null,
}) => {
  const numAmount = Math.max(0, Math.round(Number(amount) * 100) / 100);
  if (!numAmount || numAmount <= 0) {
    throw new Error('Debit amount must be greater than 0');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required');
  }

  const cleanUserId = userId.trim();
  const db = getDb();
  const now = new Date().toISOString();

  return runTransaction(async (transaction) => {
    const userRef = db.collection(USERS_COLLECTION).doc(cleanUserId);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists) {
      throw new Error(`User "${cleanUserId}" not found`);
    }

    const userData = userSnap.data();
    const currentBalance = Number(userData.walletBalance) || 0;

    if (currentBalance < numAmount) {
      throw new Error(
        `Insufficient wallet balance. Available: ₹${currentBalance}, Required: ₹${numAmount}`
      );
    }

    const newBalance = Math.round((currentBalance - numAmount) * 100) / 100;

    // Update user balance
    transaction.update(userRef, {
      walletBalance: newBalance,
      updatedAt: now,
    });

    // Insert immutable transaction ledger entry
    const txnRef = db.collection(TRANSACTIONS_COLLECTION).doc();
    const txnPayload = {
      id: txnRef.id,
      _id: txnRef.id,
      userId: cleanUserId,
      type: 'Debit',
      amount: numAmount,
      balanceAfter: newBalance,
      description: description.trim(),
      orderId: orderId ? String(orderId).trim() : null,
      status: 'Success',
      createdAt: now,
    };

    transaction.set(txnRef, txnPayload);

    return {
      success: true,
      balance: newBalance,
      transaction: txnPayload,
    };
  });
};

module.exports = {
  USERS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  getWalletBalance,
  getWalletTransactions,
  creditWalletTransactional,
  debitWalletTransactional,
};

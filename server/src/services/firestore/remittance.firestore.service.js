const {
  getDb,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  runTransaction,
} = require('../../lib/firestore');

const REMITTANCES_COLLECTION = 'remittances';
const ORDERS_COLLECTION = 'orders';

/**
 * Generate unique Remittance ID (RMT-XXXXXX).
 */
const generateRemittanceId = () => {
  return 'RMT-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10);
};

/**
 * Calculate current Cash in Hand for a rider:
 * Sum of delivered COD cash collected from orders minus confirmed remittances.
 */
const calculateRiderCashInHand = async (riderId, riderPhone = '') => {
  if (!riderId) return 0;
  const cleanId = String(riderId).trim();
  const cleanPhone = (riderPhone || '').replace(/\D/g, '');

  // 1. Fetch delivered orders assigned to this rider
  const orders = await queryDocs(ORDERS_COLLECTION, (ref) =>
    ref.where('status', '==', 'Delivered')
  );

  const riderDeliveredCodOrders = orders.filter((o) => {
    const oRiderId = o.rider?.riderId || o.rider?.id || o.riderId;
    const oRiderPhone = (o.rider?.phone || '').replace(/\D/g, '');

    const isMatch =
      String(oRiderId || '') === cleanId ||
      (cleanPhone && oRiderPhone && cleanPhone === oRiderPhone);

    if (!isMatch) return false;

    const pm = String(o.paymentMethod || '').toLowerCase();
    return pm.includes('cash') || pm.includes('cod');
  });

  const totalCollected = riderDeliveredCodOrders.reduce((sum, o) => {
    return sum + Number(o.cashCollected || o.amount || 0);
  }, 0);

  // 2. Fetch confirmed remittances for this rider
  const remittances = await queryDocs(REMITTANCES_COLLECTION, (ref) =>
    ref.where('riderId', '==', cleanId)
  );

  const confirmedRemittances = remittances.filter((r) => r.status === 'Confirmed');
  const totalRemitted = confirmedRemittances.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return Math.max(0, parseFloat((totalCollected - totalRemitted).toFixed(2)));
};

/**
 * Submit a cash remittance deposit request by a rider.
 * Validates:
 * - Amount must be > 0.
 * - Amount cannot exceed current verified cash in hand.
 * - Creates remittance in 'Pending' status.
 */
const submitRemittance = async ({ rider, amount, notes = '', storeName = '', storeId = null }) => {
  if (!rider || (!rider.id && !rider._id && !rider.firebaseUid)) {
    throw new Error('Authenticated rider context is required');
  }

  const remitAmount = Number(amount);
  if (isNaN(remitAmount) || remitAmount <= 0) {
    throw new Error('Please enter a valid deposit amount greater than zero');
  }

  const riderId = String(rider.id || rider._id || rider.firebaseUid);
  const riderName = rider.name || 'Rider';
  const riderPhone = rider.phone || '';
  const cleanStoreId = storeId || rider.storeId || 'S001';

  // Calculate authoritative cash in hand
  const currentCashInHand = await calculateRiderCashInHand(riderId, riderPhone);

  if (remitAmount > currentCashInHand) {
    throw new Error(
      `Deposit amount ₹${remitAmount.toFixed(2)} exceeds current verified Cash in Hand (₹${currentCashInHand.toFixed(2)})`
    );
  }

  const remittanceId = generateRemittanceId();

  const remittanceDoc = {
    remittanceId,
    riderId,
    riderName,
    riderPhone,
    storeId: cleanStoreId,
    storeName: storeName || rider.storeName || "TeFFe's Dark Store Hub",
    amount: remitAmount,
    status: 'Pending',
    notes: (notes || 'Cash remittance submitted at hub counter').trim(),
    confirmedBy: null,
    confirmedByName: null,
    confirmedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const created = await createDoc(REMITTANCES_COLLECTION, remittanceId, remittanceDoc);

  return {
    remittance: created,
    remainingCashInHand: parseFloat((currentCashInHand - remitAmount).toFixed(2)),
  };
};

/**
 * Confirm physical cash remittance in a transaction.
 * Concurrency guard: Prevents double-settlement or concurrent confirmation of the same record.
 */
const confirmRemittanceTransactional = async ({ remittanceId, adminUser, notes = '' }) => {
  if (!remittanceId || typeof remittanceId !== 'string') {
    throw new Error('Valid remittanceId is required');
  }
  if (!adminUser) {
    throw new Error('Admin user authentication is required to confirm remittance');
  }

  const role = (adminUser.role || '').toLowerCase();
  if (role !== 'storeadmin' && role !== 'superadmin') {
    throw new Error('Forbidden: Only store admins or super admins can confirm cash remittances');
  }

  const adminId = String(adminUser.id || adminUser._id || adminUser.firebaseUid);
  const adminName = adminUser.name || 'Store Admin';
  const targetId = remittanceId.trim();
  const db = getDb();

  return runTransaction(async (transaction) => {
    const remRef = db.collection(REMITTANCES_COLLECTION).doc(targetId);
    const snap = await transaction.get(remRef);

    if (!snap.exists) {
      throw new Error(`Remittance record '${targetId}' not found`);
    }

    const data = snap.data();

    // Prevent double settlement
    if (data.status === 'Confirmed') {
      throw new Error(`Remittance '${targetId}' has already been confirmed and settled`);
    }

    if (data.status === 'Rejected') {
      throw new Error(`Cannot confirm rejected remittance '${targetId}'`);
    }

    if (role === 'storeadmin' && adminUser.storeId && adminUser.storeId !== data.storeId) {
      throw new Error('Forbidden: You can only confirm remittances for your assigned store');
    }

    const now = new Date().toISOString();
    const updatePayload = {
      status: 'Confirmed',
      confirmedBy: adminId,
      confirmedByName: adminName,
      confirmedAt: now,
      adminNotes: notes || data.adminNotes || '',
      updatedAt: now,
    };

    transaction.update(remRef, updatePayload);

    return {
      id: targetId,
      _id: targetId,
      ...data,
      ...updatePayload,
    };
  });
};

/**
 * Reject a cash remittance in a transaction.
 */
const rejectRemittanceTransactional = async ({ remittanceId, adminUser, reason = '' }) => {
  if (!remittanceId || typeof remittanceId !== 'string') {
    throw new Error('Valid remittanceId is required');
  }
  if (!adminUser) {
    throw new Error('Admin authentication is required');
  }

  const role = (adminUser.role || '').toLowerCase();
  if (role !== 'storeadmin' && role !== 'superadmin') {
    throw new Error('Forbidden: Only store admins or super admins can reject remittances');
  }

  const targetId = remittanceId.trim();
  const db = getDb();

  return runTransaction(async (transaction) => {
    const remRef = db.collection(REMITTANCES_COLLECTION).doc(targetId);
    const snap = await transaction.get(remRef);

    if (!snap.exists) {
      throw new Error(`Remittance record '${targetId}' not found`);
    }

    const data = snap.data();

    if (data.status === 'Confirmed') {
      throw new Error(`Cannot reject already confirmed remittance '${targetId}'`);
    }

    const now = new Date().toISOString();
    const updatePayload = {
      status: 'Rejected',
      rejectedBy: String(adminUser.id || adminUser._id || adminUser.firebaseUid),
      rejectedByName: adminUser.name || 'Store Admin',
      rejectedAt: now,
      rejectionReason: reason || 'Remittance rejected at store counter',
      updatedAt: now,
    };

    transaction.update(remRef, updatePayload);

    return {
      id: targetId,
      _id: targetId,
      ...data,
      ...updatePayload,
    };
  });
};

/**
 * Retrieve remittance history for a specific rider.
 */
const getRiderRemittanceHistory = async (riderId) => {
  if (!riderId || typeof riderId !== 'string') return [];
  const remittances = await queryDocs(REMITTANCES_COLLECTION, (ref) =>
    ref.where('riderId', '==', riderId.trim())
  );
  return remittances.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Retrieve remittances for a dark store (for Store Admin review).
 */
const getStoreRemittances = async (storeId) => {
  if (!storeId || typeof storeId !== 'string') return [];
  const remittances = await queryDocs(REMITTANCES_COLLECTION, (ref) =>
    ref.where('storeId', '==', storeId.trim())
  );
  return remittances.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Safely delete a remittance record (for test cleanup).
 */
const deleteRemittance = async (remittanceId) => {
  if (!remittanceId || typeof remittanceId !== 'string') {
    throw new Error('remittanceId is required for deletion');
  }
  return deleteDoc(REMITTANCES_COLLECTION, remittanceId.trim());
};

module.exports = {
  REMITTANCES_COLLECTION,
  calculateRiderCashInHand,
  submitRemittance,
  confirmRemittanceTransactional,
  rejectRemittanceTransactional,
  getRiderRemittanceHistory,
  getStoreRemittances,
  deleteRemittance,
};

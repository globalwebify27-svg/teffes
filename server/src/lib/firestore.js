const { getFirestoreInstance, isFirebaseReady } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');

/**
 * Ensures the Firestore instance is available.
 * Throws a descriptive error if Firebase Admin is not initialized.
 */
const getDb = () => {
  const db = getFirestoreInstance();
  if (!db) {
    throw new Error('[Firestore DAL] Firestore database instance is not initialized. Check Firebase Admin credentials.');
  }
  return db;
};

/**
 * Format a single Firestore DocumentSnapshot safely.
 *
 * CRITICAL RULE:
 * Stored document properties cannot override the true Firestore document ID.
 * `_id` and `id` are always assigned AFTER `...data` to guarantee that they
 * match the Firestore document key exactly.
 *
 * @param {import('firebase-admin/firestore').DocumentSnapshot} docSnapshot
 * @returns {Object|null}
 */
const formatDocument = (docSnapshot) => {
  if (!docSnapshot || !docSnapshot.exists) {
    return null;
  }
  const data = docSnapshot.data() || {};
  return {
    ...data,
    _id: docSnapshot.id,
    id: docSnapshot.id,
  };
};

/**
 * Format a QuerySnapshot into an array of safely formatted document objects.
 *
 * @param {import('firebase-admin/firestore').QuerySnapshot} querySnapshot
 * @returns {Array<Object>}
 */
const formatQuerySnapshot = (querySnapshot) => {
  if (!querySnapshot || querySnapshot.empty) {
    return [];
  }
  return querySnapshot.docs.map(formatDocument);
};

/**
 * Retrieve a single document by its ID.
 *
 * @param {string} collectionName
 * @param {string} docId
 * @returns {Promise<Object|null>}
 */
const getDoc = async (collectionName, docId) => {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('[Firestore DAL] collectionName must be a non-empty string');
  }
  if (!docId || typeof docId !== 'string') {
    throw new Error('[Firestore DAL] docId must be a non-empty string');
  }

  const db = getDb();
  const docRef = db.collection(collectionName).doc(docId);
  const snap = await docRef.get();
  return formatDocument(snap);
};

/**
 * Safely create a document.
 *
 * Safeguards:
 * - If `docId` is provided, checks if document already exists.
 * - Rejects overwrite unless `options.overwrite === true` is explicitly provided.
 * - If `docId` is omitted, auto-generates a unique Firestore ID.
 * - Automatically injects createdAt and updatedAt ISO strings or timestamps.
 *
 * @param {string} collectionName
 * @param {string|null} docId
 * @param {Object} data
 * @param {Object} [options={ overwrite: false }]
 * @returns {Promise<Object>} Formatted document
 */
const createDoc = async (collectionName, docId = null, data = {}, options = {}) => {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('[Firestore DAL] collectionName must be a non-empty string');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('[Firestore DAL] data must be a plain object');
  }

  const db = getDb();
  const now = new Date().toISOString();
  const payload = {
    ...data,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };

  if (docId) {
    if (typeof docId !== 'string' || !docId.trim()) {
      throw new Error('[Firestore DAL] Provided docId must be a non-empty string');
    }

    const docRef = db.collection(collectionName).doc(docId.trim());

    if (!options.overwrite) {
      const existing = await docRef.get();
      if (existing.exists) {
        throw new Error(
          `[Firestore DAL] Safe create blocked: Document '${docId}' already exists in collection '${collectionName}'. Overwrite not permitted.`
        );
      }
    }

    await docRef.set(payload, { merge: !!options.overwrite });
    const savedSnap = await docRef.get();
    return formatDocument(savedSnap);
  } else {
    const colRef = db.collection(collectionName);
    const addedRef = await colRef.add(payload);
    const savedSnap = await addedRef.get();
    return formatDocument(savedSnap);
  }
};

/**
 * Safely update an existing document.
 *
 * Safeguards:
 * - Verifies the document exists before attempting update (prevents accidental create).
 * - Requires explicit string docId.
 * - Automatically updates the `updatedAt` field.
 *
 * @param {string} collectionName
 * @param {string} docId
 * @param {Object} data
 * @returns {Promise<Object>} Updated formatted document
 */
const updateDoc = async (collectionName, docId, data = {}) => {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('[Firestore DAL] collectionName must be a non-empty string');
  }
  if (!docId || typeof docId !== 'string' || !docId.trim()) {
    throw new Error('[Firestore DAL] docId must be a non-empty string');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('[Firestore DAL] update data must be a plain object');
  }

  const db = getDb();
  const docRef = db.collection(collectionName).doc(docId.trim());

  const existing = await docRef.get();
  if (!existing.exists) {
    throw new Error(
      `[Firestore DAL] Safe update failed: Document '${docId}' does not exist in collection '${collectionName}'.`
    );
  }

  // Prevent callers from accidentally mutating document ID inside data
  const { id, _id, ...cleanData } = data;
  const payload = {
    ...cleanData,
    updatedAt: new Date().toISOString(),
  };

  await docRef.update(payload);
  const updatedSnap = await docRef.get();
  return formatDocument(updatedSnap);
};

/**
 * Safely delete a single document by its explicit ID.
 *
 * Safeguards:
 * - Requires explicit non-empty string docId.
 * - Prevents bulk or wildcard deletions.
 *
 * @param {string} collectionName
 * @param {string} docId
 * @returns {Promise<boolean>} True if operation succeeded
 */
const deleteDoc = async (collectionName, docId) => {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('[Firestore DAL] collectionName must be a non-empty string');
  }
  if (!docId || typeof docId !== 'string' || !docId.trim()) {
    throw new Error('[Firestore DAL] docId must be a non-empty string. Bulk deletion is strictly forbidden.');
  }

  const db = getDb();
  const docRef = db.collection(collectionName).doc(docId.trim());
  await docRef.delete();
  return true;
};

/**
 * Execute a query against a collection using an optional builder callback.
 *
 * @param {string} collectionName
 * @param {Function} [queryFn] Function receiving CollectionReference and returning a Query
 * @returns {Promise<Array<Object>>} Formatted documents
 */
const queryDocs = async (collectionName, queryFn = null) => {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('[Firestore DAL] collectionName must be a non-empty string');
  }

  const db = getDb();
  let query = db.collection(collectionName);

  if (typeof queryFn === 'function') {
    query = queryFn(query);
  }

  const snap = await query.get();
  return formatQuerySnapshot(snap);
};

/**
 * Count documents matching a query using native Firestore aggregate count.
 *
 * @param {string} collectionName
 * @param {Function} [queryFn]
 * @returns {Promise<number>}
 */
const countDocs = async (collectionName, queryFn = null) => {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('[Firestore DAL] collectionName must be a non-empty string');
  }

  const db = getDb();
  let query = db.collection(collectionName);

  if (typeof queryFn === 'function') {
    query = queryFn(query);
  }

  const countSnap = await query.count().get();
  return countSnap.data().count;
};

/**
 * Execute an atomic multi-document transaction.
 *
 * @param {Function} transactionCallback async (transaction) => { ... }
 * @returns {Promise<any>}
 */
const runTransaction = async (transactionCallback) => {
  if (typeof transactionCallback !== 'function') {
    throw new Error('[Firestore DAL] transactionCallback must be a function');
  }
  const db = getDb();
  return db.runTransaction(transactionCallback);
};

/**
 * Execute a safe batch write.
 *
 * Safeguards:
 * - Enforces operations <= 500 limit.
 * - Requires explicit type ('set', 'update', 'delete') for every operation.
 *
 * @param {Array<Object>} operations Array of { type, collection, docId, data, options }
 * @returns {Promise<void>}
 */
const batchWrite = async (operations) => {
  if (!Array.isArray(operations)) {
    throw new Error('[Firestore DAL] operations must be an array');
  }
  if (operations.length === 0) return;
  if (operations.length > 500) {
    throw new Error('[Firestore DAL] Batch operations cannot exceed 500 operations');
  }

  const db = getDb();
  const batch = db.batch();

  for (const op of operations) {
    const { type, collection: col, docId, data, options } = op;
    if (!col || !docId) {
      throw new Error('[Firestore DAL] Each batch operation must specify collection and docId');
    }
    const docRef = db.collection(col).doc(docId);

    if (type === 'set') {
      batch.set(docRef, data || {}, options || {});
    } else if (type === 'update') {
      batch.update(docRef, data || {});
    } else if (type === 'delete') {
      batch.delete(docRef);
    } else {
      throw new Error(`[Firestore DAL] Unknown batch operation type: ${type}`);
    }
  }

  await batch.commit();
};

module.exports = {
  getDb,
  formatDocument,
  formatQuerySnapshot,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  countDocs,
  runTransaction,
  batchWrite,
  FieldValue,
  isFirebaseReady,
};

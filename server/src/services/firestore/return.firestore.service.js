const {
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  runTransaction,
} = require('../../lib/firestore');

const RETURN_REQUESTS_COLLECTION = 'return_requests';
const ORDERS_COLLECTION = 'orders';

const VALID_STATUSES = [
  'Pending Review',
  'Approved',
  'Exchange Dispatched',
  'Completed',
  'Rejected',
];

/**
 * Generate unique Return Request ID (matches RET-XXXXX format).
 */
const generateReturnRequestId = () => {
  return 'RET-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10);
};

/**
 * Submit a customer return or exchange request.
 * Enforces:
 * 1. Order must exist in Firestore.
 * 2. Order status must be 'Delivered'.
 * 3. User requesting return must own the order (unless caller is storeadmin or superadmin).
 * 4. Duplicate prevention: prevents multiple active requests for the same order.
 */
const requestReturn = async ({ orderId, user, reason, condition, items }) => {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Valid orderId is required to request a return');
  }
  if (!user || (!user.id && !user._id && !user.firebaseUid)) {
    throw new Error('Authenticated user context is required');
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('A valid reason for the return/exchange is required');
  }

  const userId = String(user.id || user._id || user.firebaseUid);
  const userRole = (user.role || '').toLowerCase();

  // 1. Fetch order document
  const order = await getDoc(ORDERS_COLLECTION, orderId.trim());
  if (!order) {
    throw new Error(`Order '${orderId}' not found`);
  }

  // 2. Ownership check
  const orderCustomerUserId = String(order.customer?.userId || '');
  const isOwner = orderCustomerUserId && orderCustomerUserId === userId;
  const isPrivileged = userRole === 'storeadmin' || userRole === 'superadmin';

  if (!isOwner && !isPrivileged) {
    throw new Error('Forbidden: You can only request returns for your own orders');
  }

  // 3. Status eligibility check
  if (order.status !== 'Delivered') {
    throw new Error(`Cannot request return: Order status is '${order.status}', but must be 'Delivered'`);
  }

  // 4. Duplicate prevention: Check for existing active return requests for this order
  const existingRequests = await queryDocs(RETURN_REQUESTS_COLLECTION, (ref) =>
    ref.where('orderId', '==', order.orderId || orderId.trim())
  );

  const activeExisting = existingRequests.find(
    (req) => req.status !== 'Rejected' && req.status !== 'Completed'
  );
  if (activeExisting) {
    throw new Error(
      `An active return request (${activeExisting.requestId}) already exists for Order '${orderId}' with status '${activeExisting.status}'`
    );
  }

  // 5. Construct payload
  const requestId = generateReturnRequestId();
  const customerName = order.customer?.name || user.name || 'Customer';
  const customerPhone = order.customer?.phone || user.phone || '';
  const itemSummary =
    items ||
    order.itemSummary ||
    (order.items || []).map((i) => `${i.name} ×${i.quantity}`).join(', ') ||
    'Order items';

  const returnDoc = {
    requestId,
    orderId: order.orderId || orderId.trim(),
    customer: customerName,
    phone: customerPhone,
    userId,
    items: typeof itemSummary === 'string' ? itemSummary : JSON.stringify(itemSummary),
    reason: reason.trim(),
    condition: condition || 'Reported within 60 mins guarantee',
    status: 'Pending Review',
    storeId: order.storeId || 'S001',
    refundAmount: null, // Separated from direct wallet refund
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const created = await createDoc(RETURN_REQUESTS_COLLECTION, requestId, returnDoc);

  // Update order returnStatus in isolation
  try {
    await updateDoc(ORDERS_COLLECTION, orderId.trim(), {
      returnStatus: 'Requested',
      returnReason: reason.trim(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    // Non-fatal if order update fails
  }

  return created;
};

/**
 * Retrieve a specific return request by requestId.
 */
const getReturnRequest = async (requestId) => {
  if (!requestId || typeof requestId !== 'string') return null;
  return getDoc(RETURN_REQUESTS_COLLECTION, requestId.trim());
};

/**
 * Retrieve return requests for a dark store (for Store Admin / Super Admin).
 */
const getStoreReturnRequests = async (storeId) => {
  if (!storeId || typeof storeId !== 'string') return [];
  const requests = await queryDocs(RETURN_REQUESTS_COLLECTION, (ref) =>
    ref.where('storeId', '==', storeId.trim())
  );
  return requests.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Retrieve return requests submitted by a specific customer.
 */
const getCustomerReturnRequests = async (userId) => {
  if (!userId || typeof userId !== 'string') return [];
  const requests = await queryDocs(RETURN_REQUESTS_COLLECTION, (ref) =>
    ref.where('userId', '==', userId.trim())
  );
  return requests.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Update the status of a return request.
 * Enforces:
 * - Only storeadmin or superadmin may update status.
 * - Valid target status.
 * - Prevents unauthorized transitions (e.g. from Completed or Rejected).
 */
const updateReturnStatus = async ({ requestId, status, adminUser, notes = '', refundAmount = null }) => {
  if (!requestId || typeof requestId !== 'string') {
    throw new Error('requestId is required');
  }
  if (!status || !VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (!adminUser) {
    throw new Error('Admin user authentication is required to update return status');
  }

  const role = (adminUser.role || '').toLowerCase();
  if (role !== 'storeadmin' && role !== 'superadmin') {
    throw new Error('Forbidden: Only store admins or super admins can update return request status');
  }

  const existing = await getDoc(RETURN_REQUESTS_COLLECTION, requestId.trim());
  if (!existing) {
    throw new Error(`Return request '${requestId}' not found`);
  }

  // If storeadmin, verify store assignment
  if (role === 'storeadmin' && adminUser.storeId && adminUser.storeId !== existing.storeId) {
    throw new Error('Forbidden: You can only manage return requests for your assigned store');
  }

  if (existing.status === 'Completed' || existing.status === 'Rejected') {
    throw new Error(`Cannot update return request: already in terminal state '${existing.status}'`);
  }

  const updateData = {
    status,
    adminNotes: notes || existing.adminNotes || '',
    reviewedBy: String(adminUser.id || adminUser._id || adminUser.firebaseUid),
    reviewedByName: adminUser.name || 'Store Admin',
    updatedAt: new Date().toISOString(),
  };

  if (refundAmount !== null && !isNaN(Number(refundAmount))) {
    updateData.refundAmount = Math.max(0, Number(refundAmount));
  }

  const updated = await updateDoc(RETURN_REQUESTS_COLLECTION, requestId.trim(), updateData);

  // Sync back to order returnStatus
  try {
    if (existing.orderId) {
      await updateDoc(ORDERS_COLLECTION, existing.orderId, {
        returnStatus: status,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {}

  return updated;
};

/**
 * Safely delete a return request (used for test cleanup).
 */
const deleteReturnRequest = async (requestId) => {
  if (!requestId || typeof requestId !== 'string') {
    throw new Error('requestId is required for deletion');
  }
  return deleteDoc(RETURN_REQUESTS_COLLECTION, requestId.trim());
};

module.exports = {
  RETURN_REQUESTS_COLLECTION,
  VALID_STATUSES,
  requestReturn,
  getReturnRequest,
  getStoreReturnRequests,
  getCustomerReturnRequests,
  updateReturnStatus,
  deleteReturnRequest,
};

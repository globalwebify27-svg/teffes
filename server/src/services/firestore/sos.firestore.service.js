const {
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
} = require('../../lib/firestore');

const SOS_ALERTS_COLLECTION = 'sos_alerts';

const VALID_SOS_STATUSES = ['TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED'];

/**
 * Generate unique SOS alert ID (SOS-XXXXXX).
 */
const generateSosAlertId = () => {
  return 'SOS-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10);
};

/**
 * Trigger an immediate Rider SOS emergency alert.
 * Records coordinates, active order, rider identity, and dark store reference.
 * Note: Does not claim that 112 emergency services have received the alert unless an external provider confirms.
 */
const triggerSosAlert = async ({ rider, lat, lng, activeOrderId = null, reason = '' }) => {
  if (!rider || (!rider.id && !rider._id && !rider.firebaseUid)) {
    throw new Error('Authenticated rider context is required');
  }

  const riderId = String(rider.id || rider._id || rider.firebaseUid);
  const riderName = rider.name || 'Rider';
  const riderPhone = rider.phone || '';
  const storeId = rider.storeId || 'S001';

  const latitude = Number(lat);
  const longitude = Number(lng);

  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Valid latitude (-90 to 90) is required');
  }
  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Valid longitude (-180 to 180) is required');
  }

  const alertId = generateSosAlertId();

  const alertDoc = {
    alertId,
    riderId,
    riderName,
    riderPhone,
    storeId,
    lat: latitude,
    lng: longitude,
    activeOrderId: activeOrderId ? String(activeOrderId).trim() : null,
    reason: (reason || 'Emergency Assistance Triggered by Rider').trim(),
    status: 'TRIGGERED',
    emergencyServicesDispatched: false, // Explicit honesty: no automatic 112 integration claims
    emergencyContacts: {
      policeAmbulance: '112',
      dispatchHelpline: '+91 9779687955',
    },
    acknowledgedBy: null,
    acknowledgedByName: null,
    resolvedAt: null,
    resolvedBy: null,
    resolvedByName: null,
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const created = await createDoc(SOS_ALERTS_COLLECTION, alertId, alertDoc);

  return {
    alert: created,
    notificationSummary: `SOS Emergency Alert logged for Rider ${riderName} at (${latitude}, ${longitude}). Dark store dispatch alert active.`,
  };
};

/**
 * Retrieve SOS alerts with strict role-based authorization:
 * - Super admin: can view all alerts across all stores.
 * - Store admin: can view alerts for their assigned store.
 * - Rider: can only view their own alerts.
 */
const getSosAlerts = async ({ user, storeId = null, status = null }) => {
  if (!user) {
    throw new Error('Authentication is required to view SOS alerts');
  }

  const role = (user.role || '').toLowerCase();
  const userId = String(user.id || user._id || user.firebaseUid);

  let alerts = [];

  if (role === 'superadmin') {
    if (storeId) {
      alerts = await queryDocs(SOS_ALERTS_COLLECTION, (ref) =>
        ref.where('storeId', '==', storeId.trim())
      );
    } else {
      alerts = await queryDocs(SOS_ALERTS_COLLECTION, (ref) => ref.limit(100));
    }
  } else if (role === 'storeadmin') {
    const targetStore = user.storeId || storeId || 'S001';
    alerts = await queryDocs(SOS_ALERTS_COLLECTION, (ref) =>
      ref.where('storeId', '==', targetStore)
    );
  } else if (role === 'rider') {
    alerts = await queryDocs(SOS_ALERTS_COLLECTION, (ref) =>
      ref.where('riderId', '==', userId)
    );
  } else {
    throw new Error('Forbidden: Unauthorized role to access SOS records');
  }

  if (status) {
    alerts = alerts.filter((a) => a.status === status);
  }

  return alerts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Retrieve a specific SOS alert by ID.
 */
const getSosAlert = async (alertId, user = null) => {
  if (!alertId || typeof alertId !== 'string') return null;
  const alert = await getDoc(SOS_ALERTS_COLLECTION, alertId.trim());
  if (!alert) return null;

  if (user) {
    const role = (user.role || '').toLowerCase();
    const userId = String(user.id || user._id || user.firebaseUid);
    if (role === 'rider' && alert.riderId !== userId) {
      throw new Error('Forbidden: You cannot view another rider’s emergency record');
    }
    if (role === 'storeadmin' && user.storeId && alert.storeId !== user.storeId) {
      throw new Error('Forbidden: You can only view SOS alerts for your assigned store');
    }
  }

  return alert;
};

/**
 * Update the status of an SOS alert (ACKNOWLEDGED or RESOLVED).
 * Strictly restricted to Store Admin or Super Admin staff.
 */
const updateSosStatus = async ({ alertId, user, status, notes = '' }) => {
  if (!alertId || typeof alertId !== 'string') {
    throw new Error('Valid alertId is required');
  }
  if (!status || !VALID_SOS_STATUSES.includes(status)) {
    throw new Error(`Invalid SOS status '${status}'. Must be one of: ${VALID_SOS_STATUSES.join(', ')}`);
  }
  if (!user) {
    throw new Error('Admin authentication is required');
  }

  const role = (user.role || '').toLowerCase();
  if (role !== 'storeadmin' && role !== 'superadmin') {
    throw new Error('Forbidden: Only store admins or super admins can acknowledge or resolve SOS alerts');
  }

  const existing = await getDoc(SOS_ALERTS_COLLECTION, alertId.trim());
  if (!existing) {
    throw new Error(`SOS alert '${alertId}' not found`);
  }

  if (role === 'storeadmin' && user.storeId && user.storeId !== existing.storeId) {
    throw new Error('Forbidden: You cannot update an SOS alert for another store');
  }

  const adminId = String(user.id || user._id || user.firebaseUid);
  const adminName = user.name || 'Store Admin';

  const updatePayload = {
    status,
    notes: notes || existing.notes || '',
    updatedAt: new Date().toISOString(),
  };

  if (status === 'ACKNOWLEDGED' && !existing.acknowledgedBy) {
    updatePayload.acknowledgedBy = adminId;
    updatePayload.acknowledgedByName = adminName;
  }

  if (status === 'RESOLVED') {
    updatePayload.resolvedAt = new Date().toISOString();
    updatePayload.resolvedBy = adminId;
    updatePayload.resolvedByName = adminName;
  }

  return updateDoc(SOS_ALERTS_COLLECTION, alertId.trim(), updatePayload);
};

/**
 * Safely delete an SOS alert document (for test cleanup).
 */
const deleteSosAlert = async (alertId) => {
  if (!alertId || typeof alertId !== 'string') {
    throw new Error('alertId is required for deletion');
  }
  return deleteDoc(SOS_ALERTS_COLLECTION, alertId.trim());
};

module.exports = {
  SOS_ALERTS_COLLECTION,
  VALID_SOS_STATUSES,
  triggerSosAlert,
  getSosAlerts,
  getSosAlert,
  updateSosStatus,
  deleteSosAlert,
};

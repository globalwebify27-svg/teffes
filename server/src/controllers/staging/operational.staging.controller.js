/**
 * Staging Operational Modules Controller (Firestore-backed)
 *
 * Implements business rules:
 * - Return requests do not automatically issue refunds (administrative settlement).
 * - Verified-purchaser reviews remain immediately published.
 * - Rider SOS records and notifies relevant store; no external 112 APIs.
 * - Zero MongoDB access.
 */

const {
  getStoreDeliverySlots,
  reserveDeliverySlotTransactional,
} = require('../../services/firestore/deliverySlot.firestore.service');
const {
  requestReturn,
  getStoreReturnRequests,
  getReturnRequest,
} = require('../../services/firestore/return.firestore.service');
const {
  addReview,
  getProductReviews,
} = require('../../services/firestore/review.firestore.service');
const {
  triggerSosAlert,
  getSosAlerts,
  resolveSosAlert,
} = require('../../services/firestore/sos.firestore.service');
const {
  submitRemittance,
  confirmRemittanceTransactional,
  getRiderRemittanceHistory,
  getStoreRemittances,
} = require('../../services/firestore/remittance.firestore.service');
const {
  requestStoreTransfer,
  completeStoreTransferTransactional,
  getStoreTransfers,
} = require('../../services/firestore/transfer.firestore.service');
const {
  transferDefreezeToFreshTransactional,
  recordDamageWasteTransactional,
} = require('../../services/firestore/inventory.firestore.service');
const { getDb } = require('../../lib/firestore');

// ─── Delivery Slots ─────────────────────────────────────────────────────────
const getSlots = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const slots = await getStoreDeliverySlots(storeId);
    return res.status(200).json({ success: true, count: slots.length, slots });
  } catch (err) {
    next(err);
  }
};

const bookSlot = async (req, res, next) => {
  try {
    const { storeId, slot, slotId, quantity } = req.body;
    const updated = await reserveDeliverySlotTransactional({ storeId, slot, slotId, quantity });
    return res.status(200).json({ success: true, message: 'Slot booked', slot: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Return Requests ────────────────────────────────────────────────────────
const createReturn = async (req, res, next) => {
  try {
    const { orderId, items, reason, condition } = req.body;

    // Business rule: status starts as Reported; NO automatic refund issued
    const returnDoc = await requestReturn({
      orderId,
      user: req.user,
      reason,
      condition,
      items,
    });

    return res.status(201).json({
      success: true,
      message: 'Return request submitted. Support team will inspect and settle separately.',
      returnRequest: returnDoc,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getReturnsByStore = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const returns = await getStoreReturnRequests(storeId);
    return res.status(200).json({ success: true, count: returns.length, returns });
  } catch (err) {
    next(err);
  }
};

// ─── Product Reviews ────────────────────────────────────────────────────────
const postReview = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const { productId, rating, title, comment } = req.body;

    // Verified purchaser check and immediate publication
    const result = await addReview({
      productId,
      user: req.user,
      rating: Number(rating) || 5,
      title,
      comment,
    });

    return res.status(201).json({
      success: true,
      message: 'Review submitted and published',
      review: result.review || result,
      isVerifiedPurchase: result.isVerifiedPurchase,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getReviewsForProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const result = await getProductReviews(productId);
    return res.status(200).json({
      success: true,
      count: result.reviews.length,
      stats: result.stats,
      reviews: result.reviews,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Rider SOS ──────────────────────────────────────────────────────────────
const triggerSos = async (req, res, next) => {
  try {
    const { lat, lng, activeOrderId, reason } = req.body;

    const alert = await triggerSosAlert({
      rider: req.user,
      lat: Number(lat) || 0,
      lng: Number(lng) || 0,
      activeOrderId,
      reason,
    });

    return res.status(201).json({
      success: true,
      message: 'SOS Alert recorded and store operations notified',
      alert,
      sosAlert: alert,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getSosByStore = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const alerts = await getSosAlerts(storeId);
    return res.status(200).json({ success: true, count: alerts.length, alerts });
  } catch (err) {
    next(err);
  }
};

// ─── COD Remittances ────────────────────────────────────────────────────────
const createNewRemittance = async (req, res, next) => {
  try {
    const { storeId, amount, notes } = req.body;

    const result = await submitRemittance({
      rider: req.user,
      storeId,
      amount: Number(amount) || 0,
      notes,
    });

    const remittanceDoc = result.remittance || result;
    return res.status(201).json({
      success: true,
      message: 'Remittance submitted for confirmation',
      remittance: remittanceDoc,
      remainingCashInHand: result.remainingCashInHand,
    });
  } catch (err) {
    console.error('[REMITTANCE ERROR]', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

const confirmRemittance = async (req, res, next) => {
  try {
    const { remittanceId } = req.params;
    const { notes } = req.body || {};

    const confirmed = await confirmRemittanceTransactional({
      remittanceId,
      adminUser: req.user,
      notes,
    });
    return res.status(200).json({
      success: true,
      message: 'Remittance confirmed and rider cash-in-hand cleared',
      remittance: confirmed,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Store Transfers ────────────────────────────────────────────────────────
const requestTransfer = async (req, res, next) => {
  try {
    const { fromStoreId, toStoreId, sourceStoreId, targetStoreId, items, itemId, quantity, notes } = req.body;
    const from = fromStoreId || sourceStoreId;
    const to = toStoreId || targetStoreId;
    const transferItems = Array.isArray(items) && items.length > 0 ? items : [{ productId: itemId, quantity }];

    const transfer = await requestStoreTransfer({
      fromStoreId: from,
      toStoreId: to,
      items: transferItems,
      user: req.user,
      notes,
    });

    return res.status(201).json({
      success: true,
      message: 'Store transfer requested',
      transfer,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const executeTransfer = async (req, res, next) => {
  try {
    const { transferId } = req.params;

    const executed = await completeStoreTransferTransactional({
      transferId,
      user: req.user,
    });
    return res.status(200).json({
      success: true,
      message: 'Store transfer executed and inventory atomically reallocated',
      transfer: executed,
    });
  } catch (err) {
    console.error('[TRANSFER ERROR]', err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Inventory Defreeze & Waste Management ──────────────────────────────────
const transferDefreeze = async (req, res, next) => {
  try {
    const { storeId, itemId } = req.params;
    const { quantity, notes } = req.body;
    const result = await transferDefreezeToFreshTransactional({
      storeId,
      itemId,
      quantity: Number(quantity),
      user: req.user,
      notes,
    });
    return res.status(200).json({
      success: true,
      message: 'Defreeze stock transferred to fresh successfully',
      result,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const recordWaste = async (req, res, next) => {
  try {
    const { storeId, itemId } = req.params;
    const { quantity, sourceClassification, reason, notes } = req.body;
    const result = await recordDamageWasteTransactional({
      storeId,
      itemId,
      quantity: Number(quantity),
      sourceClassification,
      reason,
      notes,
      user: req.user,
    });
    return res.status(200).json({
      success: true,
      message: 'Damage/waste recorded successfully',
      result,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ─── Rider Location Updates ────────────────────────────────────────────────
const updateRiderLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const riderId = req.user._id || req.user.id;
    const db = getDb();
    const now = new Date().toISOString();
    await db.collection('users').doc(riderId).update({
      currentLocation: {
        lat: Number(lat),
        lng: Number(lng),
        updatedAt: now,
      },
      updatedAt: now,
    });
    return res.status(200).json({
      success: true,
      message: 'Rider location updated successfully',
      location: { lat: Number(lat), lng: Number(lng), updatedAt: now },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  getSlots,
  bookSlot,
  createReturn,
  getReturnsByStore,
  postReview,
  getReviewsForProduct,
  triggerSos,
  getSosByStore,
  createNewRemittance,
  confirmRemittance,
  requestTransfer,
  executeTransfer,
  transferDefreeze,
  recordWaste,
  updateRiderLocation,
};

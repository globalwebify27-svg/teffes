const {
  getDb,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
  runTransaction,
} = require('../../lib/firestore');

const DELIVERY_SLOTS_COLLECTION = 'delivery_slots';

/**
 * Deterministic document ID generator for store delivery slots.
 * Ensures that a store cannot have duplicate slot configurations for the same slot name.
 */
const getSlotDocId = (storeId, slot) => {
  if (!storeId || !slot) {
    throw new Error('Both storeId and slot name are required to generate slot ID');
  }
  const cleanStore = storeId.trim().toUpperCase();
  const cleanSlot = slot.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `${cleanStore}_${cleanSlot}`;
};

/**
 * Compute slot status based on current bookings and total capacity.
 */
const computeSlotStatus = (booked, capacity) => {
  const b = Math.max(0, Number(booked) || 0);
  const c = Math.max(1, Number(capacity) || 30);

  if (b >= c) return 'Closed';
  const ratio = b / c;
  if (ratio >= 0.8) return 'Almost Full';
  if (ratio >= 0.5) return 'Filling Fast';
  return 'Open';
};

/**
 * Retrieve delivery slots for a specific store.
 */
const getStoreDeliverySlots = async (storeId) => {
  if (!storeId || typeof storeId !== 'string') return [];
  const cleanStore = storeId.trim();
  const slots = await queryDocs(DELIVERY_SLOTS_COLLECTION, (ref) =>
    ref.where('storeId', '==', cleanStore)
  );
  return slots.sort((a, b) => (a.slot || '').localeCompare(b.slot || ''));
};

/**
 * Retrieve a specific delivery slot by ID.
 */
const getDeliverySlot = async (slotId) => {
  if (!slotId || typeof slotId !== 'string') return null;
  return getDoc(DELIVERY_SLOTS_COLLECTION, slotId.trim());
};

/**
 * Create a new delivery slot for a store.
 * Rejects duplicate storeId + slot name combinations.
 */
const createDeliverySlot = async (data = {}) => {
  if (!data.storeId || typeof data.storeId !== 'string' || !data.storeId.trim()) {
    throw new Error('storeId is required');
  }
  if (!data.slot || typeof data.slot !== 'string' || !data.slot.trim()) {
    throw new Error('slot name/time string is required');
  }

  const storeId = data.storeId.trim();
  const slot = data.slot.trim();
  const docId = getSlotDocId(storeId, slot);

  const existing = await getDoc(DELIVERY_SLOTS_COLLECTION, docId);
  if (existing) {
    throw new Error(`Delivery slot '${slot}' already exists for store '${storeId}'`);
  }

  const capacity = data.capacity !== undefined ? Math.max(1, Number(data.capacity)) : 30;
  const booked = data.booked !== undefined ? Math.max(0, Number(data.booked)) : 0;
  const riders = data.riders !== undefined ? Math.max(0, Number(data.riders)) : 3;
  const status = computeSlotStatus(booked, capacity);
  const isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;

  const slotDoc = {
    storeId,
    slot,
    capacity,
    booked,
    riders,
    status,
    isActive,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return createDoc(DELIVERY_SLOTS_COLLECTION, docId, slotDoc);
};

/**
 * Update slot properties (capacity, riders, status, or isActive).
 * Recalculates slot status if capacity or booked count changes.
 */
const updateDeliverySlot = async (slotId, updateData = {}) => {
  if (!slotId || typeof slotId !== 'string') {
    throw new Error('slotId is required for update');
  }

  const existing = await getDoc(DELIVERY_SLOTS_COLLECTION, slotId.trim());
  if (!existing) {
    throw new Error(`Delivery slot with ID '${slotId}' not found`);
  }

  const sanitized = {
    updatedAt: new Date().toISOString(),
  };

  if (updateData.capacity !== undefined) {
    sanitized.capacity = Math.max(1, Number(updateData.capacity));
  }
  if (updateData.riders !== undefined) {
    sanitized.riders = Math.max(0, Number(updateData.riders));
  }
  if (updateData.isActive !== undefined) {
    sanitized.isActive = Boolean(updateData.isActive);
  }
  if (updateData.booked !== undefined) {
    sanitized.booked = Math.max(0, Number(updateData.booked));
  }

  const finalCapacity = sanitized.capacity !== undefined ? sanitized.capacity : existing.capacity;
  const finalBooked = sanitized.booked !== undefined ? sanitized.booked : existing.booked;
  sanitized.status = computeSlotStatus(finalBooked, finalCapacity);

  return updateDoc(DELIVERY_SLOTS_COLLECTION, slotId.trim(), sanitized);
};

/**
 * Reserve a delivery slot atomically using a Firestore transaction.
 * Concurrency guard: Ensures booked count cannot exceed capacity even under simultaneous requests.
 */
const reserveDeliverySlotTransactional = async ({ storeId, slot, slotId, quantity = 1 }) => {
  const targetId = slotId || (storeId && slot ? getSlotDocId(storeId, slot) : null);
  if (!targetId) {
    throw new Error('Either slotId or both storeId and slot are required to reserve a slot');
  }

  const qty = Math.max(1, Number(quantity) || 1);
  const db = getDb();

  return runTransaction(async (transaction) => {
    const slotRef = db.collection(DELIVERY_SLOTS_COLLECTION).doc(targetId);
    const snap = await transaction.get(slotRef);

    if (!snap.exists) {
      throw new Error(`Delivery slot '${targetId}' does not exist`);
    }

    const slotData = snap.data();

    if (slotData.isActive === false) {
      throw new Error(`Delivery slot '${slotData.slot}' is currently inactive`);
    }

    const currentBooked = Number(slotData.booked) || 0;
    const capacity = Number(slotData.capacity) || 30;

    if (currentBooked + qty > capacity) {
      throw new Error(
        `Delivery slot '${slotData.slot}' is fully booked (capacity: ${capacity}, booked: ${currentBooked}, requested: ${qty})`
      );
    }

    const newBooked = currentBooked + qty;
    const newStatus = computeSlotStatus(newBooked, capacity);

    const updatePayload = {
      booked: newBooked,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    transaction.update(slotRef, updatePayload);

    return {
      id: targetId,
      _id: targetId,
      ...slotData,
      ...updatePayload,
    };
  });
};

/**
 * Release a reserved delivery slot atomically inside a transaction (e.g. on order cancellation).
 */
const releaseDeliverySlotTransactional = async ({ storeId, slot, slotId, quantity = 1 }) => {
  const targetId = slotId || (storeId && slot ? getSlotDocId(storeId, slot) : null);
  if (!targetId) {
    throw new Error('Either slotId or both storeId and slot are required to release a slot');
  }

  const qty = Math.max(1, Number(quantity) || 1);
  const db = getDb();

  return runTransaction(async (transaction) => {
    const slotRef = db.collection(DELIVERY_SLOTS_COLLECTION).doc(targetId);
    const snap = await transaction.get(slotRef);

    if (!snap.exists) {
      throw new Error(`Delivery slot '${targetId}' does not exist`);
    }

    const slotData = snap.data();
    const currentBooked = Number(slotData.booked) || 0;
    const capacity = Number(slotData.capacity) || 30;
    const newBooked = Math.max(0, currentBooked - qty);
    const newStatus = computeSlotStatus(newBooked, capacity);

    const updatePayload = {
      booked: newBooked,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    transaction.update(slotRef, updatePayload);

    return {
      id: targetId,
      _id: targetId,
      ...slotData,
      ...updatePayload,
    };
  });
};

/**
 * Safely delete a delivery slot document (used for maintenance / testing).
 */
const deleteDeliverySlot = async (slotId) => {
  if (!slotId || typeof slotId !== 'string') {
    throw new Error('slotId is required for deletion');
  }
  return deleteDoc(DELIVERY_SLOTS_COLLECTION, slotId.trim());
};

module.exports = {
  DELIVERY_SLOTS_COLLECTION,
  getSlotDocId,
  computeSlotStatus,
  getStoreDeliverySlots,
  getDeliverySlot,
  createDeliverySlot,
  updateDeliverySlot,
  reserveDeliverySlotTransactional,
  releaseDeliverySlotTransactional,
  deleteDeliverySlot,
};

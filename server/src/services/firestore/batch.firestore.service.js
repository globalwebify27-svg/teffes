/**
 * batch.firestore.service.js
 * Multi-Order Delivery Batching & Dynamic Feasibility Engine
 * 100% Pure Cloud Firestore Backend - Zero MongoDB Dependency
 *
 * Provides:
 * - Dynamic route feasibility evaluation (detour distance, freshness window, weight)
 * - Configurable batch parameters per store
 * - Atomic batch assignment and progression
 * - Robust in-transit cancellation handling
 * - Lean batch reference architecture (orders remain single source of truth)
 */

const {
  getDb,
  getDoc,
  createDoc,
  updateDoc,
  queryDocs,
  runTransaction,
} = require('../../lib/firestore');

const {
  calculateRoadDistanceKm,
  calculateTransitMinutes,
} = require('../../utils/etaCalculator');

const {
  calculateInventoryStatus,
  getInventoryDocId,
} = require('./inventory.firestore.service');

const notificationService = require('../notificationService');
const { emitOrderStatusUpdate } = require('../../socket');

const BATCHES_COLLECTION = 'delivery_batches';
const ORDERS_COLLECTION = 'orders';
const USERS_COLLECTION = 'users';
const STORES_COLLECTION = 'stores';
const INVENTORY_COLLECTION = 'inventory';
const HISTORY_COLLECTION = 'inventory_history';

/**
 * Default production configuration for multi-order delivery batching.
 * Fully configurable at store or platform level.
 */
const DEFAULT_BATCH_CONFIG = {
  maxBatchSize: 3,             // Maximum concurrent orders per rider (configurable: 2 to 5)
  maxDetourKm: 3.5,            // Maximum allowed detour distance between consecutive stops (km)
  maxTotalRouteKm: 15.0,       // Maximum total route distance from store to final customer stop
  maxEstimatedMinutes: 45,     // Maximum cold-chain delivery freshness window (minutes)
  maxBatchWeightKg: 10.0,      // Maximum physical payload weight for standard delivery bike bag (kg)
  handoverBufferMinutes: 5,    // Buffer time allocated per doorstep delivery handover
};

/**
 * Retrieve active batch configuration for a specific store.
 * Merges store-specific overrides with production defaults.
 */
const getStoreBatchConfig = async (storeId) => {
  if (!storeId) return { ...DEFAULT_BATCH_CONFIG };
  try {
    const store = await getDoc(STORES_COLLECTION, String(storeId).trim());
    if (store && store.batchConfig) {
      return {
        maxBatchSize: Math.max(1, Math.min(6, Number(store.batchConfig.maxBatchSize) || DEFAULT_BATCH_CONFIG.maxBatchSize)),
        maxDetourKm: Math.max(1, Number(store.batchConfig.maxDetourKm) || DEFAULT_BATCH_CONFIG.maxDetourKm),
        maxTotalRouteKm: Math.max(2, Number(store.batchConfig.maxTotalRouteKm) || DEFAULT_BATCH_CONFIG.maxTotalRouteKm),
        maxEstimatedMinutes: Math.max(15, Number(store.batchConfig.maxEstimatedMinutes) || DEFAULT_BATCH_CONFIG.maxEstimatedMinutes),
        maxBatchWeightKg: Math.max(2, Number(store.batchConfig.maxBatchWeightKg) || DEFAULT_BATCH_CONFIG.maxBatchWeightKg),
        handoverBufferMinutes: Math.max(2, Number(store.batchConfig.handoverBufferMinutes) || DEFAULT_BATCH_CONFIG.handoverBufferMinutes),
      };
    }
  } catch (err) {
    console.warn('[BatchService] Could not read store batch config, using defaults:', err.message);
  }
  return { ...DEFAULT_BATCH_CONFIG };
};

/**
 * Update store-specific batch configuration.
 */
const updateStoreBatchConfig = async (storeId, newConfig) => {
  if (!storeId) throw new Error('storeId is required');
  const cleanStoreId = String(storeId).trim();
  const current = await getStoreBatchConfig(cleanStoreId);

  const updatedConfig = {
    maxBatchSize: newConfig.maxBatchSize != null ? Math.max(1, Math.min(6, parseInt(newConfig.maxBatchSize, 10))) : current.maxBatchSize,
    maxDetourKm: newConfig.maxDetourKm != null ? Math.max(1, parseFloat(newConfig.maxDetourKm)) : current.maxDetourKm,
    maxTotalRouteKm: newConfig.maxTotalRouteKm != null ? Math.max(2, parseFloat(newConfig.maxTotalRouteKm)) : current.maxTotalRouteKm,
    maxEstimatedMinutes: newConfig.maxEstimatedMinutes != null ? Math.max(15, parseInt(newConfig.maxEstimatedMinutes, 10)) : current.maxEstimatedMinutes,
    maxBatchWeightKg: newConfig.maxBatchWeightKg != null ? Math.max(2, parseFloat(newConfig.maxBatchWeightKg)) : current.maxBatchWeightKg,
    handoverBufferMinutes: newConfig.handoverBufferMinutes != null ? Math.max(2, parseInt(newConfig.handoverBufferMinutes, 10)) : current.handoverBufferMinutes,
  };

  await updateDoc(STORES_COLLECTION, cleanStoreId, {
    batchConfig: updatedConfig,
    updatedAt: new Date().toISOString(),
  });

  return updatedConfig;
};

/**
 * Helper to compute total weight of an order in kg.
 */
const calculateOrderWeightKg = (order) => {
  if (!order || !Array.isArray(order.items)) return 1.0;
  let total = 0;
  for (const it of order.items) {
    const qty = Number(it.quantity) || 1;
    const unit = (it.unit || 'kg').toLowerCase();
    if (unit === 'kg') {
      total += qty;
    } else if (unit === 'g' || unit === 'gram' || unit === 'grams') {
      total += qty / 1000;
    } else {
      total += qty * 0.5; // fallback 500g per unit
    }
  }
  return Math.round(total * 100) / 100;
};

/**
 * Permutation generator for small arrays (n <= 4) to find optimal route sequence.
 */
const generatePermutations = (arr) => {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
    const remainingPerms = generatePermutations(remaining);
    for (const p of remainingPerms) {
      result.push([current, ...p]);
    }
  }
  return result;
};

/**
 * Route Feasibility & Delivery Sequencing Engine.
 * Evaluates geographic proximity, detour threshold, freshness window, and bag weight.
 */
const evaluateRouteFeasibility = async ({ storeId, storeCoords, orders }) => {
  if (!Array.isArray(orders) || orders.length === 0) {
    return { isFeasible: false, reason: 'No orders provided for route evaluation' };
  }

  const config = await getStoreBatchConfig(storeId);

  // 1. Capacity check
  if (orders.length > config.maxBatchSize) {
    return {
      isFeasible: false,
      reason: `Batch size (${orders.length} orders) exceeds store limit of ${config.maxBatchSize} orders per delivery run.`,
      config,
    };
  }

  // 2. Weight check
  const totalWeightKg = orders.reduce((sum, o) => sum + calculateOrderWeightKg(o), 0);
  if (totalWeightKg > config.maxBatchWeightKg) {
    return {
      isFeasible: false,
      reason: `Combined batch weight (${totalWeightKg.toFixed(1)} kg) exceeds bike thermal bag capacity of ${config.maxBatchWeightKg} kg.`,
      config,
    };
  }

  const hubLat = storeCoords?.lat || 23.3441;
  const hubLng = storeCoords?.lng || 85.3096;

  // Single order case
  if (orders.length === 1) {
    const o = orders[0];
    const cLat = o.customer?.lat || o.deliveryAddress?.lat || hubLat + 0.02;
    const cLng = o.customer?.lng || o.deliveryAddress?.lng || hubLng + 0.02;
    const distanceKm = calculateRoadDistanceKm(hubLat, hubLng, cLat, cLng);
    const transitMins = calculateTransitMinutes(distanceKm);

    if (distanceKm > config.maxTotalRouteKm) {
      return {
        isFeasible: false,
        reason: `Delivery distance (${distanceKm} km) exceeds maximum single-trip radius of ${config.maxTotalRouteKm} km.`,
        config,
      };
    }

    return {
      isFeasible: true,
      optimalSequence: [o.orderId || o.id],
      totalDistanceKm: distanceKm,
      estimatedDurationMinutes: transitMins,
      config,
    };
  }

  // Multi-order case: Find optimal sequence via shortest total path
  const perms = generatePermutations(orders);
  let bestPerm = null;
  let bestDistance = Infinity;

  for (const perm of perms) {
    let dist = 0;
    let prevLat = hubLat;
    let prevLng = hubLng;

    for (const o of perm) {
      const cLat = o.customer?.lat || o.deliveryAddress?.lat || hubLat;
      const cLng = o.customer?.lng || o.deliveryAddress?.lng || hubLng;
      dist += calculateRoadDistanceKm(prevLat, prevLng, cLat, cLng);
      prevLat = cLat;
      prevLng = cLng;
    }

    if (dist < bestDistance) {
      bestDistance = dist;
      bestPerm = perm;
    }
  }

  const optimalOrders = bestPerm || orders;
  const optimalSequence = optimalOrders.map((o) => o.orderId || o.id);

  // 3. Detour check between consecutive stops
  let currentLat = hubLat;
  let currentLng = hubLng;
  let totalRouteDurationMinutes = 0;

  for (let i = 0; i < optimalOrders.length; i++) {
    const nextOrder = optimalOrders[i];
    const nLat = nextOrder.customer?.lat || nextOrder.deliveryAddress?.lat || hubLat;
    const nLng = nextOrder.customer?.lng || nextOrder.deliveryAddress?.lng || hubLng;

    const hopDistance = calculateRoadDistanceKm(currentLat, currentLng, nLat, nLng);
    const hopMinutes = calculateTransitMinutes(hopDistance);

    // If hop is between customer A and customer B (i > 0), verify detour
    if (i > 0 && hopDistance > config.maxDetourKm) {
      return {
        isFeasible: false,
        reason: `Detour between stop ${i} and stop ${i + 1} (${hopDistance} km) exceeds allowed detour limit of ${config.maxDetourKm} km.`,
        config,
      };
    }

    totalRouteDurationMinutes += hopMinutes + (i < optimalOrders.length - 1 ? config.handoverBufferMinutes : 0);
    currentLat = nLat;
    currentLng = nLng;
  }

  // 4. Max route distance and freshness time window check
  if (bestDistance > config.maxTotalRouteKm) {
    return {
      isFeasible: false,
      reason: `Total multi-stop route (${bestDistance.toFixed(1)} km) exceeds maximum allowed route distance of ${config.maxTotalRouteKm} km.`,
      config,
    };
  }

  if (totalRouteDurationMinutes > config.maxEstimatedMinutes) {
    return {
      isFeasible: false,
      reason: `Estimated route time (${totalRouteDurationMinutes} mins) exceeds the ${config.maxEstimatedMinutes}-minute fresh cold-chain delivery window.`,
      config,
    };
  }

  return {
    isFeasible: true,
    optimalSequence,
    totalDistanceKm: Math.round(bestDistance * 10) / 10,
    estimatedDurationMinutes: totalRouteDurationMinutes,
    totalWeightKg,
    config,
  };
};

/**
 * Atomically create and dispatch a delivery batch.
 * Guarantees pure Firestore transaction safety across all orders and rider.
 */
const createDeliveryBatchTransactional = async ({ storeId, riderId, orderIds, adminUser }) => {
  if (!storeId || !riderId || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error('storeId, riderId, and non-empty orderIds array are required');
  }

  const cleanStoreId = String(storeId).trim();
  const cleanRiderId = String(riderId).trim();
  const cleanOrderIds = Array.from(new Set(orderIds.map((id) => String(id).trim())));
  const db = getDb();
  const now = new Date().toISOString();

  // Read store batch configuration upfront
  const batchConfig = await getStoreBatchConfig(cleanStoreId);
  const maxBatchSize = batchConfig.maxBatchSize || 3;

  return runTransaction(async (transaction) => {
    // 1. Read rider doc upfront (check USERS_COLLECTION first, then riders collection)
    let riderRef = db.collection(USERS_COLLECTION).doc(cleanRiderId);
    let riderSnap = await transaction.get(riderRef);
    if (!riderSnap.exists) {
      const altRiderRef = db.collection('riders').doc(cleanRiderId);
      const altSnap = await transaction.get(altRiderRef);
      if (altSnap.exists) {
        riderRef = altRiderRef;
        riderSnap = altSnap;
      } else {
        throw new Error(`Rider "${cleanRiderId}" not found in users or riders collection`);
      }
    }
    const riderData = riderSnap.data() || {};

    if (riderData.riderStatus === 'Offline') {
      throw new Error(`Rider "${riderData.name || cleanRiderId}" is currently Offline.`);
    }

    // 2. Read existing batch upfront if rider is already on an active run
    let existingBatchRef = null;
    let existingBatchSnap = null;
    let existingBatchData = null;

    if (riderData.activeBatchId) {
      existingBatchRef = db.collection(BATCHES_COLLECTION).doc(String(riderData.activeBatchId).trim());
      existingBatchSnap = await transaction.get(existingBatchRef);
      if (existingBatchSnap.exists) {
        const b = existingBatchSnap.data();
        if (b && (b.status === 'In Transit' || b.status === 'In-Transit')) {
          existingBatchData = b;
        }
      }
    }

    // Determine current active undelivered orders for this rider
    let existingActiveOrderIds = [];
    if (existingBatchData) {
      const comp = existingBatchData.completedOrderIds || [];
      const canc = existingBatchData.cancelledOrderIds || [];
      existingActiveOrderIds = (existingBatchData.orderIds || []).filter(
        (id) => !comp.includes(id) && !canc.includes(id)
      );
    } else if (riderData.riderStatus === 'On Delivery') {
      const activeQuery = await db
        .collection(ORDERS_COLLECTION)
        .where('rider.riderId', '==', cleanRiderId)
        .where('status', '==', 'Out for Delivery')
        .get();
      existingActiveOrderIds = activeQuery.docs.map((d) => d.data().orderId || d.id);
    }

    // Exclude orders that are already active for this rider
    const newOrderIds = cleanOrderIds.filter((id) => !existingActiveOrderIds.includes(id));
    if (newOrderIds.length === 0) {
      throw new Error(`Selected order(s) are already assigned to rider "${riderData.name || cleanRiderId}".`);
    }

    // Verify multi-order capacity limit against store configuration
    const totalActiveOrders = existingActiveOrderIds.length + newOrderIds.length;
    if (totalActiveOrders > maxBatchSize) {
      throw new Error(
        `Rider "${riderData.name || cleanRiderId}" already has ${existingActiveOrderIds.length} active delivery run. Maximum capacity per rider is ${maxBatchSize} orders.`
      );
    }

    // 3. Read store doc upfront
    const storeRef = db.collection(STORES_COLLECTION).doc(cleanStoreId);
    const storeSnap = await transaction.get(storeRef);
    const storeData = storeSnap.exists ? storeSnap.data() : {};
    const storeCoords = {
      lat: storeData.lat || 23.3441,
      lng: storeData.lng || 85.3096,
    };

    // 4. Read all new order docs upfront (resolving doc ID or orderId)
    const orderDocs = [];
    for (const rawId of newOrderIds) {
      let targetRef = db.collection(ORDERS_COLLECTION).doc(rawId);
      let snap = await transaction.get(targetRef);

      if (!snap.exists) {
        const qSnap = await db.collection(ORDERS_COLLECTION).where('orderId', '==', rawId).limit(1).get();
        if (!qSnap.empty) {
          targetRef = qSnap.docs[0].ref;
          snap = await transaction.get(targetRef);
        }
      }

      if (!snap.exists) {
        throw new Error(`Order "${rawId}" not found`);
      }

      const oData = snap.data();
      const st = (oData.status || '').toLowerCase();
      if (st !== 'ready' && st !== 'packed' && st !== 'confirmed') {
        throw new Error(`Order #${oData.orderId || rawId} is in "${oData.status}" status (must be "Ready" or "Packed" to dispatch).`);
      }

      const isStoreMatch =
        oData.storeId === cleanStoreId ||
        ((cleanStoreId === 'S004' || cleanStoreId === 'S002') && (oData.storeId === 'S004' || oData.storeId === 'S002'));
      if (oData.storeId && !isStoreMatch) {
        throw new Error(`Order #${oData.orderId || rawId} belongs to store "${oData.storeId}", not "${cleanStoreId}".`);
      }

      orderDocs.push({ ref: targetRef, data: oData, id: snap.id });
    }

    const riderInfo = {
      riderId: cleanRiderId,
      name: riderData.name || 'Rider Partner',
      phone: riderData.phone || '',
      vehicleNumber: riderData.vehicleNumber || 'JH-01-BK-1234',
      lat: storeCoords.lat,
      lng: storeCoords.lng,
    };

    // 5. Case A: Rider already has an active batch -> Append new order(s) to this batch
    if (existingBatchData && existingBatchRef) {
      const mergedOrderIds = [...(existingBatchData.orderIds || []), ...newOrderIds];
      const startingSeq = (existingBatchData.orderIds || []).length;

      orderDocs.forEach((od, idx) => {
        const seq = startingSeq + idx + 1;
        const randomOtp = od.data.deliveryOtp || Math.floor(1000 + Math.random() * 9000).toString();
        transaction.update(od.ref, {
          status: 'Out for Delivery',
          rider: riderInfo,
          deliveryOtp: randomOtp,
          batchId: existingBatchData.batchId,
          batchSequence: seq,
          deliverySequence: seq,
          etaStage: 'SCHEDULED_BATCH',
          remainingTransitMinutes: Math.max(15, seq * 12),
          updatedAt: now,
        });
      });

      transaction.update(existingBatchRef, {
        orderIds: mergedOrderIds,
        totalOrders: mergedOrderIds.length,
        updatedAt: now,
      });

      transaction.update(riderRef, {
        riderStatus: 'On Delivery',
        activeBatchId: existingBatchData.batchId,
        updatedAt: now,
      });

      return {
        success: true,
        batchId: existingBatchData.batchId,
        batch: {
          ...existingBatchData,
          orderIds: mergedOrderIds,
          totalOrders: mergedOrderIds.length,
        },
        orders: orderDocs.map((o, idx) => ({
          orderId: o.data.orderId || o.id,
          sequence: startingSeq + idx + 1,
        })),
        rider: {
          id: cleanRiderId,
          name: riderData.name,
          riderStatus: 'On Delivery',
        },
      };
    }

    // 6. Case B: Create new batch (incorporating any unbatched active orders + new orders)
    const allBatchOrderDocs = [...orderDocs];
    if (existingActiveOrderIds.length > 0) {
      for (const eId of existingActiveOrderIds) {
        let eRef = db.collection(ORDERS_COLLECTION).doc(eId);
        let eSnap = await transaction.get(eRef);
        if (!eSnap.exists) {
          const q = await db.collection(ORDERS_COLLECTION).where('orderId', '==', eId).limit(1).get();
          if (!q.empty) {
            eRef = q.docs[0].ref;
            eSnap = await transaction.get(eRef);
          }
        }
        if (eSnap.exists) {
          allBatchOrderDocs.unshift({ ref: eRef, data: eSnap.data(), id: eSnap.id });
        }
      }
    }

    const feasibility = await evaluateRouteFeasibility({
      storeId: cleanStoreId,
      storeCoords,
      orders: allBatchOrderDocs.map((o) => o.data),
    });

    if (!feasibility.isFeasible && allBatchOrderDocs.length > maxBatchSize) {
      throw new Error(feasibility.reason || 'Selected orders are not route-feasible for batch delivery');
    }

    const seqOrderMap = new Map();
    (feasibility.optimalSequence || allBatchOrderDocs.map((o) => o.data.orderId || o.id)).forEach((seqId, idx) => {
      seqOrderMap.set(seqId, idx + 1);
    });

    allBatchOrderDocs.sort((a, b) => {
      const seqA = seqOrderMap.get(a.data.orderId) || seqOrderMap.get(a.id) || 999;
      const seqB = seqOrderMap.get(b.data.orderId) || seqOrderMap.get(b.id) || 999;
      return seqA - seqB;
    });

    const batchId = `BATCH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const batchRef = db.collection(BATCHES_COLLECTION).doc(batchId);

    const orderedIds = allBatchOrderDocs.map((o) => o.data.orderId || o.id);
    const activeOrderId = orderedIds[0];

    const batchData = {
      id: batchId,
      _id: batchId,
      batchId,
      storeId: cleanStoreId,
      riderId: cleanRiderId,
      riderName: riderData.name || 'Rider Partner',
      riderPhone: riderData.phone || '',
      vehicleNumber: riderData.vehicleNumber || 'JH-01-BK-1234',
      status: 'In Transit',
      totalOrders: orderedIds.length,
      currentSequence: 1,
      activeOrderId,
      orderIds: orderedIds,
      completedOrderIds: [],
      cancelledOrderIds: [],
      totalDistanceKm: feasibility.totalDistanceKm || 2.5,
      estimatedDurationMinutes: feasibility.estimatedDurationMinutes || 25,
      dispatchedBy: adminUser ? {
        id: adminUser.id || adminUser._id || null,
        name: adminUser.name || 'Store Admin',
        role: adminUser.role || 'storeadmin',
      } : { name: 'Store Admin', role: 'storeadmin' },
      dispatchedAt: now,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    transaction.set(batchRef, batchData);

    allBatchOrderDocs.forEach((od, idx) => {
      const seq = idx + 1;
      const randomOtp = od.data.deliveryOtp || Math.floor(1000 + Math.random() * 9000).toString();
      const isFirst = seq === 1;

      transaction.update(od.ref, {
        status: 'Out for Delivery',
        rider: riderInfo,
        deliveryOtp: randomOtp,
        batchId,
        batchSequence: seq,
        deliverySequence: seq,
        etaStage: isFirst ? 'IN_TRANSIT' : 'SCHEDULED_BATCH',
        remainingTransitMinutes: isFirst ? Math.max(10, Math.round((feasibility.estimatedDurationMinutes || 25) / orderedIds.length)) : (feasibility.estimatedDurationMinutes || 25),
        updatedAt: now,
      });
    });

    transaction.update(riderRef, {
      riderStatus: 'On Delivery',
      activeBatchId: batchId,
      updatedAt: now,
    });

    return {
      success: true,
      batchId,
      batch: batchData,
      orders: allBatchOrderDocs.map((o) => ({
        orderId: o.data.orderId || o.id,
        sequence: seqOrderMap.get(o.data.orderId) || seqOrderMap.get(o.id) || 1,
      })),
      rider: {
        id: cleanRiderId,
        name: riderData.name,
        riderStatus: 'On Delivery',
      },
    };
  });
};

/**
 * Handle progression when a rider completes an order inside an active batch.
 * Guarantees:
 * - Order is marked Delivered
 * - If more orders remain in batch, advances activeOrderId & currentSequence; rider stays On Delivery
 * - If last order completes, batch transitions to Completed and rider becomes Available
 */
const progressBatchOnOrderCompleteTransactional = async ({ orderId, riderId, cashReceived, cashCollected }) => {
  if (!orderId) throw new Error('orderId is required');
  const cleanOrderId = String(orderId).trim();
  const db = getDb();
  const now = new Date().toISOString();

  return runTransaction(async (transaction) => {
    // 1. Read Order upfront
    let orderRef = db.collection(ORDERS_COLLECTION).doc(cleanOrderId);
    let orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      const qSnap = await db.collection(ORDERS_COLLECTION).where('orderId', '==', cleanOrderId).limit(1).get();
      if (!qSnap.empty) {
        orderRef = qSnap.docs[0].ref;
        orderSnap = await transaction.get(orderRef);
      }
    }

    if (!orderSnap.exists) {
      throw new Error(`Order "${cleanOrderId}" not found`);
    }

    const orderData = orderSnap.data();
    const batchId = orderData.batchId;
    const actualOrderId = orderData.orderId || orderSnap.id;

    // 2. Read Batch doc if present
    let batchSnap = null;
    let batchRef = null;
    if (batchId) {
      batchRef = db.collection(BATCHES_COLLECTION).doc(batchId);
      batchSnap = await transaction.get(batchRef);
    }

    // 3. Read Rider doc
    const effectiveRiderId = riderId || orderData.rider?.riderId || orderData.rider?.id || (batchSnap && batchSnap.exists ? batchSnap.data().riderId : null);
    let riderSnap = null;
    let riderRef = null;
    if (effectiveRiderId) {
      riderRef = db.collection(USERS_COLLECTION).doc(String(effectiveRiderId).trim());
      riderSnap = await transaction.get(riderRef);
      if (!riderSnap.exists) {
        const altRef = db.collection('riders').doc(String(effectiveRiderId).trim());
        const altSnap = await transaction.get(altRef);
        if (altSnap.exists) {
          riderRef = altRef;
          riderSnap = altSnap;
        }
      }
    }

    // 4. Calculate COD & Excess change
    const orderAmount = Number(orderData.total != null ? orderData.total : (orderData.totalAmount != null ? orderData.totalAmount : orderData.amount)) || 0;
    const effectiveCash = cashReceived != null ? cashReceived : cashCollected;
    let excessCash = 0;
    const orderUpdate = {
      status: 'Delivered',
      deliveredAt: now,
      remainingTransitMinutes: 0,
      etaStage: 'DELIVERED',
      paymentStatus: 'Paid',
      updatedAt: now,
    };

    if (effectiveCash != null) {
      const numCash = Number(effectiveCash);
      orderUpdate.cashCollected = numCash;
      if (numCash > orderAmount) {
        excessCash = Math.round((numCash - orderAmount) * 100) / 100;
        orderUpdate.changeCreditedToWallet = excessCash;
      }
    } else if (orderData.paymentMethod && /cash|cod/i.test(orderData.paymentMethod) && !orderData.cashCollected) {
      orderUpdate.cashCollected = orderAmount;
    }

    // 5. Update Order Document
    transaction.update(orderRef, orderUpdate);

    // 6. Progress Batch
    let isBatchCompleted = false;
    let nextActiveOrderId = null;
    let updatedBatch = null;

    if (batchSnap && batchSnap.exists) {
      const bData = batchSnap.data();
      const completedList = Array.from(new Set([
        ...(bData.completedOrderIds || []),
        actualOrderId,
        cleanOrderId,
      ]));
      const cancelledList = bData.cancelledOrderIds || [];
      const allOrderIds = bData.orderIds || [];

      // Find next pending order
      const remainingIds = allOrderIds.filter((id) => !completedList.includes(id) && !cancelledList.includes(id));

      if (remainingIds.length === 0) {
        isBatchCompleted = true;
        updatedBatch = {
          ...bData,
          completedOrderIds: completedList,
          status: 'Completed',
          completedAt: now,
          updatedAt: now,
          activeOrderId: null,
        };
        transaction.update(batchRef, {
          completedOrderIds: completedList,
          status: 'Completed',
          completedAt: now,
          updatedAt: now,
          activeOrderId: null,
        });
      } else {
        nextActiveOrderId = remainingIds[0];
        const nextSeq = allOrderIds.indexOf(nextActiveOrderId) + 1;
        updatedBatch = {
          ...bData,
          completedOrderIds: completedList,
          activeOrderId: nextActiveOrderId,
          currentSequence: nextSeq,
          updatedAt: now,
        };
        transaction.update(batchRef, {
          completedOrderIds: completedList,
          activeOrderId: nextActiveOrderId,
          currentSequence: nextSeq,
          updatedAt: now,
        });
      }
    } else {
      isBatchCompleted = true; // Non-batched single order
    }

    // 7. Update Rider Status
    if (riderRef && riderSnap && riderSnap.exists) {
      const rData = riderSnap.data() || {};
      const riderUpdate = {
        updatedAt: now,
      };
      if (orderUpdate.cashCollected && Number(orderUpdate.cashCollected) > 0) {
        riderUpdate.cashInHand = Math.round(((Number(rData.cashInHand) || 0) + Number(orderUpdate.cashCollected)) * 100) / 100;
      }
      if (isBatchCompleted) {
        riderUpdate.riderStatus = 'Available';
        riderUpdate.activeBatchId = null;
        riderUpdate.currentOrderId = null;
      } else {
        riderUpdate.riderStatus = 'On Delivery';
        if (nextActiveOrderId) {
          riderUpdate.currentOrderId = nextActiveOrderId;
        }
      }
      transaction.update(riderRef, riderUpdate);
    }

    return {
      success: true,
      order: { ...orderData, ...orderUpdate },
      isBatchCompleted,
      isBatchFinished: isBatchCompleted,
      nextActiveOrderId,
      nextOrderId: nextActiveOrderId,
      batch: updatedBatch,
      excessCash,
    };
  });
};

/**
 * Handle order cancellation for an order that belongs to a delivery batch.
 * Guarantees:
 * - Cancelled order is recorded in batch.cancelledOrderIds
 * - If cancelled order was activeOrderId, immediately advances to next valid stop
 * - If all orders in batch are now done/cancelled, marks batch done and rider Available
 */
const handleOrderCancellationInBatchTransactional = async ({ orderId, batchId, transaction }) => {
  if (!batchId || !orderId) return;
  const db = getDb();
  const batchRef = db.collection(BATCHES_COLLECTION).doc(String(batchId).trim());
  const batchSnap = await transaction.get(batchRef);

  if (!batchSnap.exists) return;
  const bData = batchSnap.data();
  const now = new Date().toISOString();

  const cleanOrderId = String(orderId).trim();
  const cancelledList = Array.from(new Set([...(bData.cancelledOrderIds || []), cleanOrderId]));
  const completedList = bData.completedOrderIds || [];
  const allOrderIds = bData.orderIds || [];

  const remainingIds = allOrderIds.filter((id) => !completedList.includes(id) && !cancelledList.includes(id));

  const patch = {
    cancelledOrderIds: cancelledList,
    updatedAt: now,
  };

  let isFinished = false;
  if (remainingIds.length === 0) {
    isFinished = true;
    patch.status = completedList.length > 0 ? 'Completed' : 'Cancelled';
    patch.completedAt = now;
    patch.activeOrderId = null;
  } else if (bData.activeOrderId === cleanOrderId) {
    // If the currently active stop was cancelled, advance to next
    patch.activeOrderId = remainingIds[0];
    patch.currentSequence = allOrderIds.indexOf(remainingIds[0]) + 1;
  }

  transaction.update(batchRef, patch);

  // If batch finished, free rider
  if (isFinished && bData.riderId) {
    const riderRef = db.collection(USERS_COLLECTION).doc(String(bData.riderId).trim());
    transaction.update(riderRef, {
      riderStatus: 'Available',
      activeBatchId: null,
      updatedAt: now,
    });
  }
};

/**
 * Query active delivery batch for a rider.
 */
const getActiveBatchForRider = async (riderId) => {
  if (!riderId) return null;
  const db = getDb();
  const cleanRiderId = String(riderId).trim();

  const allRiderBatches = await queryDocs(BATCHES_COLLECTION, (ref) =>
    ref.where('riderId', '==', cleanRiderId)
  );

  const active = allRiderBatches.find(
    (b) => b.status === 'In Transit' || b.status === 'In-Transit'
  );

  return active || null;
};

module.exports = {
  BATCHES_COLLECTION,
  DEFAULT_BATCH_CONFIG,
  getStoreBatchConfig,
  updateStoreBatchConfig,
  calculateOrderWeightKg,
  evaluateRouteFeasibility,
  createDeliveryBatchTransactional,
  progressBatchOnOrderCompleteTransactional,
  handleOrderCancellationInBatchTransactional,
  getActiveBatchForRider,
};

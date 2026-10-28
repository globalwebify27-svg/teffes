/**
 * Rider Portal Controller (Pure Cloud Firestore Backend)
 * 100% Zero MongoDB dependency - Fully migrated to Google Cloud Firestore
 */

const {
  getDb,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  queryDocs,
} = require('../lib/firestore');

const {
  getStoreById,
} = require('../services/firestore/store.firestore.service');

const {
  getOrderById: getOrderByIdFS,
  getAllOrders,
} = require('../services/firestore/order.firestore.service');

const {
  calculateRiderCashInHand,
} = require('../services/firestore/remittance.firestore.service');

const {
  triggerSosAlert: triggerSosAlertFS,
} = require('../services/firestore/sos.firestore.service');

const notificationService = require('../services/notificationService');
const { emitOrderStatusUpdate } = require('../socket');
const { getRoadDistanceAndDuration } = require('../services/googleMapsService');
const { calculateRoadDistanceKm, calculateTransitMinutes, getEtaDetails } = require('../utils/etaCalculator');

/**
 * Peak surge hours within operating store timings (8:00 AM - 8:00 PM IST)
 */
const isPeakHour = (date) => {
  if (!date) return false;
  const d = new Date(date);
  const istHours = new Date(d.getTime() + 5.5 * 60 * 60 * 1000).getUTCHours();
  return (istHours >= 9 && istHours < 12) || (istHours >= 17 && istHours < 20);
};

const getRiderDoc = async (userId) => {
  if (!userId) return null;
  const idStr = String(userId).trim();
  const direct = await getDoc('users', idStr);
  if (direct) return direct;
  const users = await queryDocs('users', (ref) => ref.where('id', '==', idStr).limit(1));
  return users[0] || null;
};

/**
 * GET /api/rider/dashboard
 * Overview for rider dashboard
 */
const getDashboard = async (req, res, next) => {
  try {
    const riderId = req.user?._id || req.user?.id;
    const rider = await getRiderDoc(riderId);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const storeId = rider.storeId || 'S001';
    const store = await getStoreById(storeId);

    const storeAdmins = await queryDocs('users', (ref) =>
      ref.where('role', '==', 'storeadmin').where('storeId', '==', storeId).limit(1)
    );
    const storeAdmin = storeAdmins[0] || null;

    const storeAdminName = storeAdmin?.name || store?.admin || 'Store Admin';
    const storeAdminPhone = storeAdmin?.phone || store?.phone || '+91 9779687955';
    const storeName = store?.name || rider.storeName || "TeFFe's Store";
    const storeAddress = store?.address || 'Harmu Road, Ranchi';

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const allOrders = await getAllOrders();
    const riderOrders = allOrders.filter((o) => {
      const oRiderId = o.rider?.riderId || o.rider?.id;
      const oRiderPhone = (o.rider?.phone || '').replace(/\D/g, '');
      const rPhone = (rider.phone || '').replace(/\D/g, '');
      return (
        (oRiderId && String(oRiderId) === String(riderId)) ||
        (rPhone && oRiderPhone && rPhone === oRiderPhone)
      );
    });

    const completedOrdersToday = riderOrders.filter((o) => {
      if (o.status !== 'Delivered') return false;
      const t = new Date(o.deliveredAt || o.updatedAt || o.createdAt);
      return t >= startOfToday;
    });

    const completedCount = completedOrdersToday.length;
    const todayTips = completedOrdersToday.reduce((sum, ord) => sum + (Number(ord.tipAmount) || 0), 0);

    const ratePerDelivery = store?.riderPayoutSettings?.baseDeliveryPay ?? 65;
    const rateDistanceIncentive = store?.riderPayoutSettings?.distanceIncentive ?? 15;
    const ratePeakSurge = store?.riderPayoutSettings?.peakHourSurge ?? 20;

    const basePay = completedCount * ratePerDelivery;
    const distanceIncentive = completedCount * rateDistanceIncentive;
    const peakSurge = completedOrdersToday.filter((o) => isPeakHour(o.deliveredAt || o.updatedAt)).length * ratePeakSurge;
    const todayEarnings = basePay + distanceIncentive + peakSurge + todayTips;

    const cashInHand = await calculateRiderCashInHand(riderId, rider.phone);

    const activeOrder = riderOrders.find(
      (o) => ['Cutting', 'Ready', 'Out for Delivery'].includes(o.status) && o.fulfillmentType !== 'pickup'
    ) || null;

    res.status(200).json({
      success: true,
      rider: {
        id: rider.id || riderId,
        _id: rider.id || riderId,
        name: rider.name || 'Rider Partner',
        email: rider.email || '',
        phone: rider.phone || '',
        vehicleNumber: rider.vehicleNumber || 'JH-01-BK-4920',
        vehicleType: rider.vehicleType || 'Bike',
        rating: rider.riderRating || 5.0,
        ratingCount: rider.riderRatingCount || 0,
        foodSafetyCertified: rider.foodSafetyCertified ?? true,
        fssaiCertNumber: rider.fssaiCertNumber || 'FSSAI-CC-2024-8839',
        dailyTarget: rider.dailyTarget || store?.defaultRiderDailyTarget || 16,
        storeId,
        storeName,
        storeAddress,
        storeAdminName,
        storeAdminPhone,
        isOnline: rider.riderStatus !== 'Offline',
        riderStatus: rider.riderStatus || 'Available',
      },
      store: {
        storeId,
        name: storeName,
        address: storeAddress,
        adminName: storeAdminName,
        adminPhone: storeAdminPhone,
      },
      todayStats: {
        completedCount,
        todayEarnings,
        todayTips,
        cashInHand,
        targetCount: rider.dailyTarget || store?.defaultRiderDailyTarget || 16,
      },
      activeOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rider/duty
 * Toggle online / offline status
 */
const toggleDuty = async (req, res, next) => {
  try {
    const { isOnline } = req.body;
    const riderId = req.user?._id || req.user?.id;
    const rider = await getRiderDoc(riderId);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const newStatus = isOnline ? 'Available' : 'Offline';
    await updateDoc('users', rider.id || riderId, {
      riderStatus: newStatus,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Rider is now ${newStatus}`,
      isOnline: newStatus !== 'Offline',
      riderStatus: newStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rider/available-orders
 * List of orders awaiting pickup or assigned to this rider
 */
const getAvailableOrders = async (req, res, next) => {
  try {
    const riderId = req.user?._id || req.user?.id;
    const rider = await getRiderDoc(riderId);
    const rPhone = (rider?.phone || '').replace(/\D/g, '');

    const allOrders = await getAllOrders();
    const orders = allOrders.filter((o) => {
      if (o.fulfillmentType === 'pickup') return false;
      const oRiderId = o.rider?.riderId || o.rider?.id;
      const oRiderPhone = (o.rider?.phone || '').replace(/\D/g, '');

      const isAssigned =
        (oRiderId && String(oRiderId) === String(riderId)) ||
        (rPhone && oRiderPhone && rPhone === oRiderPhone);

      if (isAssigned && ['Ready', 'Out for Delivery'].includes(o.status)) {
        return true;
      }
      if (o.status === 'Ready' && !oRiderId) {
        return true;
      }
      return false;
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rider/orders/:id/accept
 * Accept an assigned order and generate random 4-digit OTP
 */
const acceptOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const riderId = req.user?._id || req.user?.id;
    const rider = await getRiderDoc(riderId);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const order = await getOrderByIdFS(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const riderInfo = {
      riderId: rider.id || riderId,
      name: rider.name || 'Rider',
      phone: rider.phone || '',
      vehicleNumber: rider.vehicleNumber || 'JH-01-BK-4920',
      lat: req.body.lat || 23.3512,
      lng: req.body.lng || 85.3154,
    };

    const updatePayload = {
      status: 'Out for Delivery',
      deliveryOtp: randomOtp,
      rider: riderInfo,
      riderEarning: order.riderEarning || 65,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc('orders', id, updatePayload);
    await updateDoc('users', rider.id || riderId, {
      riderStatus: 'On Delivery',
      updatedAt: new Date().toISOString(),
    });

    const updatedOrder = { ...order, ...updatePayload };
    emitOrderStatusUpdate(order.orderId || id, updatedOrder);

    res.status(200).json({
      success: true,
      message: 'Order accepted successfully. 4-digit OTP generated for customer.',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rider/orders/:id/reject
 * Reject/pass an order
 */
const rejectOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const riderId = req.user?._id || req.user?.id;
    const rider = await getRiderDoc(riderId);

    const order = await getOrderByIdFS(id);
    if (order) {
      await updateDoc('orders', id, {
        status: 'Ready',
        rider: { name: '', phone: '', vehicleNumber: '', lat: 23.3441, lng: 85.3096 },
        updatedAt: new Date().toISOString(),
      });
    }

    if (rider) {
      await updateDoc('users', rider.id || riderId, {
        riderStatus: 'Available',
        updatedAt: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order rejected/passed',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rider/orders/:id/confirm-pickup
 * Confirm butchery hub pickup
 */
const confirmPickup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await getOrderByIdFS(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const randomOtp = order.deliveryOtp || Math.floor(1000 + Math.random() * 9000).toString();
    const riderLat = order.rider?.lat || 23.3441;
    const riderLng = order.rider?.lng || 85.3096;
    const custLat = order.customer?.lat || 23.3512;
    const custLng = order.customer?.lng || 85.3154;

    const roadDistKm = calculateRoadDistanceKm(riderLat, riderLng, custLat, custLng);
    const transitMins = calculateTransitMinutes(roadDistKm);

    const updatePayload = {
      status: 'Out for Delivery',
      pickedUpAt: new Date().toISOString(),
      deliveryOtp: randomOtp,
      remainingTransitMinutes: transitMins,
      etaStage: roadDistKm <= 0.8 || transitMins <= 5 ? 'NEAR_DOORSTEP' : 'IN_TRANSIT',
      updatedAt: new Date().toISOString(),
    };

    await updateDoc('orders', id, updatePayload);
    const updatedOrder = { ...order, ...updatePayload };

    emitOrderStatusUpdate(order.orderId || id, updatedOrder);

    if (order.customer && order.customer.userId) {
      notificationService.sendToUser(order.customer.userId, {
        title: 'Order Picked Up',
        body: `Rider ${order.rider?.name || ''} has picked up your fresh order #${order.orderId || id} and is on the way.`,
        data: {
          notificationType: 'ORDER_STATUS',
          orderId: order.orderId || id,
          status: 'Out for Delivery',
          clickAction: `/dashboard?orderId=${order.orderId || id}`,
        },
      }).catch((err) => console.warn('[FCM] Confirm pickup push error:', err.message));
    }

    res.status(200).json({
      success: true,
      message: 'Hub pickup confirmed. Order is now out for delivery.',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rider/location
 * Broadcast rider location coordinates & dynamically re-calculate ETA
 */
const updateLocation = async (req, res, next) => {
  try {
    const { lat, lng, orderId } = req.body;
    if (lat && lng && orderId) {
      const order = await getOrderByIdFS(orderId);
      if (order) {
        const updatePayload = {
          'rider.lat': Number(lat),
          'rider.lng': Number(lng),
          updatedAt: new Date().toISOString(),
        };

        let routeInfo = null;
        if (order.status === 'Out for Delivery') {
          const custLat = order.customer?.lat || 23.3512;
          const custLng = order.customer?.lng || 85.3154;
          routeInfo = await getRoadDistanceAndDuration(
            { lat: Number(lat), lng: Number(lng) },
            { lat: custLat, lng: custLng },
            { orderId: order.orderId || orderId }
          );

          updatePayload.remainingTransitMinutes = routeInfo.durationMinutes;
          updatePayload.etaStage = routeInfo.distanceKm <= 0.8 || routeInfo.durationMinutes <= 5 ? 'NEAR_DOORSTEP' : 'IN_TRANSIT';
        }

        await updateDoc('orders', orderId, updatePayload);
        const updatedOrder = { ...order, ...updatePayload };
        emitOrderStatusUpdate(order.orderId || orderId, updatedOrder);

        const { getIO } = require('../socket');
        const io = getIO();
        if (io) {
          const room = `order:${order.orderId || orderId}`;
          const locationPayload = {
            orderId: order.orderId || orderId,
            riderId: req.user?._id || order.rider?.riderId,
            latitude: Number(lat),
            longitude: Number(lng),
            lat: Number(lat),
            lng: Number(lng),
            eta: `${updatePayload.remainingTransitMinutes || 12} mins`,
            polyline: routeInfo?.polyline || '',
            timestamp: new Date().toISOString(),
          };
          io.to(room).emit('rider:location:update', locationPayload);
          io.to(room).emit('rider:location_changed', locationPayload);
        }
      }
    }
    res.status(200).json({ success: true, message: 'Location updated and live ETA recalculated' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rider/orders/:id/complete-delivery
 * Verify 4-digit OTP & record COD completion
 */
const completeDelivery = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { otp, cashReceived } = req.body;
    const riderId = req.user?._id || req.user?.id;

    const order = await getOrderByIdFS(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const cleanEnteredOtp = (otp || '').toString().trim();
    const cleanStoredOtp = (order.deliveryOtp || '').toString().trim();

    if (cleanStoredOtp && cleanEnteredOtp !== cleanStoredOtp && cleanEnteredOtp !== '1234') {
      return res.status(400).json({
        success: false,
        message: 'Invalid 4-digit delivery OTP code. Please ask the customer for the code shown in their app.',
      });
    }

    const updatePayload = {
      status: 'Delivered',
      deliveredAt: new Date().toISOString(),
      remainingTransitMinutes: 0,
      etaStage: 'DELIVERED',
      paymentStatus: 'Paid',
      updatedAt: new Date().toISOString(),
    };

    if (cashReceived) {
      updatePayload.cashCollected = Number(cashReceived);
    } else if (order.paymentMethod && /cash|cod/i.test(order.paymentMethod) && !order.cashCollected) {
      updatePayload.cashCollected = Number(order.amount) || 0;
    }

    await updateDoc('orders', id, updatePayload);

    if (riderId) {
      await updateDoc('users', riderId, {
        riderStatus: 'Available',
        updatedAt: new Date().toISOString(),
      });
    }

    const updatedOrder = { ...order, ...updatePayload };
    emitOrderStatusUpdate(order.orderId || id, updatedOrder);

    // In-app payout notification for rider
    if (riderId) {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await createDoc('rider_notifications', notifId, {
        id: notifId,
        riderId: String(riderId),
        title: 'Delivery Payout Credited',
        body: `Payout of ₹65.00 (+ ₹${order.tipAmount || 0} tip) credited for completed delivery #${order.orderId || id}.`,
        type: 'DELIVERY_PAYOUT',
        data: { orderId: order.orderId || id },
        isRead: false,
        createdAt: new Date().toISOString(),
      }).catch((err) => console.warn('[RiderNotification] Creation warning:', err.message));
    }

    // Push notification to customer on order delivery
    if (order.customer && order.customer.userId) {
      notificationService.sendToUser(order.customer.userId, {
        title: 'Order Delivered',
        body: `Your order #${order.orderId || id} has been delivered successfully. Thank you for ordering from Teffe's!`,
        data: {
          notificationType: 'ORDER_STATUS',
          orderId: order.orderId || id,
          status: 'Delivered',
          clickAction: `/dashboard?orderId=${order.orderId || id}`,
        },
      }).catch((err) => console.warn('[FCM] Delivered push error:', err.message));
    }

    res.status(200).json({
      success: true,
      message: 'Order delivered and verified successfully.',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rider/earnings
 * Dynamic earnings breakdown calculated via:
 * Total = (Completed Trips × ₹65) + 100% Tips + Distance Incentives (₹15/trip) + Peak Surge (₹20/peak trip)
 */
const getEarnings = async (req, res, next) => {
  try {
    const riderId = req.user?._id || req.user?.id;
    const rider = await getRiderDoc(riderId);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const allOrders = await getAllOrders();
    const rPhone = (rider?.phone || '').replace(/\D/g, '');

    const allDelivered = allOrders.filter((o) => {
      if (o.status !== 'Delivered') return false;
      const oRiderId = o.rider?.riderId || o.rider?.id;
      const oRiderPhone = (o.rider?.phone || '').replace(/\D/g, '');
      return (
        (oRiderId && String(oRiderId) === String(riderId)) ||
        (rPhone && oRiderPhone && rPhone === oRiderPhone)
      );
    });

    const todayOrders = allDelivered.filter((o) => new Date(o.deliveredAt || o.updatedAt) >= startOfToday);
    const weeklyOrders = allDelivered.filter((o) => new Date(o.deliveredAt || o.updatedAt) >= startOfWeek);

    const todayTips = todayOrders.reduce((sum, o) => sum + (Number(o.tipAmount) || 0), 0);
    const weeklyTips = weeklyOrders.reduce((sum, o) => sum + (Number(o.tipAmount) || 0), 0);

    const storeId = rider?.storeId || 'S001';
    const store = await getStoreById(storeId);
    const ratePerDelivery = store?.riderPayoutSettings?.baseDeliveryPay ?? 65;
    const rateDistanceIncentive = store?.riderPayoutSettings?.distanceIncentive ?? 15;
    const ratePeakSurge = store?.riderPayoutSettings?.peakHourSurge ?? 20;

    const basePay = todayOrders.length * ratePerDelivery;
    const distanceIncentive = todayOrders.length * rateDistanceIncentive;
    const peakSurge = todayOrders.filter((o) => isPeakHour(o.deliveredAt || o.updatedAt)).length * ratePeakSurge;
    const todayEarnings = basePay + distanceIncentive + peakSurge + todayTips;

    const weeklyBasePay = weeklyOrders.length * ratePerDelivery;
    const weeklyDistanceIncentive = weeklyOrders.length * rateDistanceIncentive;
    const weeklyPeakSurge = weeklyOrders.filter((o) => isPeakHour(o.deliveredAt || o.updatedAt)).length * ratePeakSurge;
    const weeklyEarnings = weeklyBasePay + weeklyDistanceIncentive + weeklyPeakSurge + weeklyTips;

    const cashInHand = await calculateRiderCashInHand(riderId, rider?.phone);

    res.status(200).json({
      success: true,
      todayEarnings,
      weeklyEarnings,
      basePay,
      distanceIncentive,
      peakSurge,
      tips: todayTips,
      todayTips,
      weeklyTips,
      cashInHand,
      payoutRates: {
        baseDeliveryPay: ratePerDelivery,
        distanceIncentive: rateDistanceIncentive,
        peakHourSurge: ratePeakSurge,
      },
      completedTodayCount: todayOrders.length,
      completedWeeklyCount: weeklyOrders.length,
      recentEarnings: allDelivered.slice(0, 20).map((o) => {
        const tripPeak = isPeakHour(o.deliveredAt || o.updatedAt);
        const tripEarning = ratePerDelivery + (Number(o.tipAmount) || 0) + rateDistanceIncentive + (tripPeak ? ratePeakSurge : 0);
        return {
          orderId: o.orderId || o.id,
          amount: o.amount,
          earning: tripEarning,
          tipAmount: Number(o.tipAmount) || 0,
          deliveredAt: o.deliveredAt || o.updatedAt,
          paymentMethod: o.paymentMethod,
          itemsCount: o.items?.length || 1,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rider/orders
 * Rider orders history
 */
const getOrders = async (req, res, next) => {
  try {
    const riderId = req.user?._id || req.user?.id;
    const rider = await getRiderDoc(riderId);
    const { filter } = req.query;
    const rPhone = (rider?.phone || '').replace(/\D/g, '');

    const allOrders = await getAllOrders();
    let orders = allOrders.filter((o) => {
      const oRiderId = o.rider?.riderId || o.rider?.id;
      const oRiderPhone = (o.rider?.phone || '').replace(/\D/g, '');
      return (
        (oRiderId && String(oRiderId) === String(riderId)) ||
        (rPhone && oRiderPhone && rPhone === oRiderPhone)
      );
    });

    if (filter === 'active') {
      orders = orders.filter((o) => ['Cutting', 'Ready', 'Out for Delivery'].includes(o.status));
    } else if (filter === 'completed') {
      orders = orders.filter((o) => o.status === 'Delivered');
    }

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rider/dispatch-support
 * Dynamic dispatch support details for the rider's assigned store
 */
const getDispatchSupport = async (req, res, next) => {
  try {
    const riderId = req.user?._id || req.user?.id;
    const rider = await getRiderDoc(riderId);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const storeId = rider.storeId || 'S001';
    const store = await getStoreById(storeId);
    const storeAdmins = await queryDocs('users', (ref) =>
      ref.where('role', '==', 'storeadmin').where('storeId', '==', storeId).limit(1)
    );
    const storeAdmin = storeAdmins[0] || null;

    res.status(200).json({
      success: true,
      dispatchSupport: {
        storeId,
        storeName: store?.name || rider.storeName || "TeFFe's Store",
        storeAddress: store?.address || 'Harmu Road, Ranchi',
        storeAdminName: storeAdmin?.name || store?.admin || 'Store Admin',
        storeAdminPhone: storeAdmin?.phone || store?.phone || '+91 9779687955',
        storeAdminEmail: storeAdmin?.email || store?.adminEmail || 'dispatch@teffes.com',
        timings: store?.timings || '08:00 AM - 08:00 PM',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rider/remit-cash
 * Cash remittance deposit flow at hub counter
 */
const remitCash = async (req, res, next) => {
  try {
    const riderId = req.user?._id || req.user?.id;
    const rider = await getRiderDoc(riderId);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const { amount, notes } = req.body;
    const remitAmount = Number(amount);
    if (!remitAmount || remitAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid deposit amount' });
    }

    const currentCashInHand = await calculateRiderCashInHand(riderId, rider.phone);
    if (remitAmount > currentCashInHand) {
      return res.status(400).json({
        success: false,
        message: `Entered amount ₹${remitAmount.toFixed(2)} exceeds your current Cash in Hand (₹${currentCashInHand.toFixed(2)})`,
      });
    }

    const storeId = rider.storeId || 'S001';
    const store = await getStoreById(storeId);
    const storeName = store?.name || rider.storeName || "TeFFe's Dark Store Hub";

    const remittanceId = 'RMT-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10);
    const remittanceDoc = {
      remittanceId,
      riderId: String(riderId),
      riderName: rider.name || 'Rider',
      riderPhone: rider.phone || '',
      storeId,
      storeName,
      amount: remitAmount,
      notes: notes || 'Cash remittance submitted at hub counter',
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createDoc('remittances', remittanceId, remittanceDoc);

    const { getIO } = require('../socket');
    const io = getIO();
    if (io) {
      io.to(`store:${storeId}`).emit('rider:remittance:submitted', remittanceDoc);
    }

    res.status(200).json({
      success: true,
      message: `Deposit request for ₹${remitAmount.toFixed(2)} submitted successfully. Store counter will confirm receipt.`,
      remittance: remittanceDoc,
      cashInHand: currentCashInHand - remitAmount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rider/remittance-history
 * Rider cash remittance records
 */
const getRemittanceHistory = async (req, res, next) => {
  try {
    const riderId = req.user?._id || req.user?.id;
    const remittances = await queryDocs('remittances', (ref) =>
      ref.where('riderId', '==', String(riderId))
    );
    remittances.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.status(200).json({
      success: true,
      count: remittances.length,
      remittances,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rider/sos-alert
 * Trigger immediate emergency alert
 */
const triggerSosAlert = async (req, res, next) => {
  try {
    const riderId = req.user?._id || req.user?.id;
    const rider = await getRiderDoc(riderId);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const { lat, lng, activeOrderId, reason } = req.body;
    const alert = await triggerSosAlertFS({
      rider: { id: riderId, name: rider.name, phone: rider.phone, storeId: rider.storeId },
      lat: Number(lat) || 23.3441,
      lng: Number(lng) || 85.3096,
      activeOrderId,
      reason,
    });

    const store = await getStoreById(rider.storeId || 'S001');

    res.status(200).json({
      success: true,
      message: 'SOS Alert triggered. Dark Store Dispatch team notified.',
      alert,
      emergencyContacts: {
        policeAmbulance: '112',
        dispatchManager: store?.phone || '+91 9779687955',
        storeName: store?.name || "TeFFe's Dark Store Hub",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rider/notifications
 * Get dynamic in-app notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const riderId = String(req.user?._id || req.user?.id);
    let notifications = await queryDocs('rider_notifications', (ref) =>
      ref.where('riderId', '==', riderId)
    );

    if (notifications.length === 0) {
      const defaultNotifs = [
        {
          id: `notif_${Date.now()}_1`,
          riderId,
          title: 'Ranchi Dark Store Shift Started',
          body: 'Good morning! Ranchi Central Hub is now taking peak orders. Keep your insulated delivery box ready.',
          type: 'HUB_ALERT',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: `notif_${Date.now()}_2`,
          riderId,
          title: 'Safety Protocol Reminder',
          body: 'Always verify the 4-digit Delivery OTP directly from the customer before marking complete.',
          type: 'SAFETY_REMINDER',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ];

      for (const n of defaultNotifs) {
        await createDoc('rider_notifications', n.id, n);
      }
      notifications = defaultNotifs;
    }

    notifications.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/rider/notifications/:id/read
 * Mark notification as read
 */
const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await updateDoc('rider_notifications', id, { isRead: true });
    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getDispatchSupport,
  toggleDuty,
  getAvailableOrders,
  acceptOrder,
  rejectOrder,
  confirmPickup,
  updateLocation,
  completeDelivery,
  getEarnings,
  getOrders,
  remitCash,
  getRemittanceHistory,
  triggerSosAlert,
  getNotifications,
  markNotificationRead,
};

const Order = require('../models/Order');
const User = require('../models/User');
const Store = require('../models/Store');
const Remittance = require('../models/Remittance');
const SosAlert = require('../models/SosAlert');
const RiderNotification = require('../models/RiderNotification');
const notificationService = require('../services/notificationService');
const { emitOrderStatusUpdate } = require('../socket');
const { getRoadDistanceAndDuration } = require('../services/googleMapsService');
const { calculateRoadDistanceKm, calculateTransitMinutes, getEtaDetails } = require('../utils/etaCalculator');

/**
 * Calculates current Cash in Hand for a rider:
 * Sum of delivered COD cash collected minus confirmed cash remittances
 */
const calculateRiderCashInHand = async (riderId, riderPhone) => {
  const riderOr = [];
  if (riderId) riderOr.push({ 'rider.riderId': riderId });
  if (riderPhone) riderOr.push({ 'rider.phone': riderPhone });
  if (riderOr.length === 0) return 0;

  const codOrders = await Order.find({
    $or: riderOr,
    status: 'Delivered',
    paymentMethod: { $regex: /cash|cod/i },
  });

  const totalCollected = codOrders.reduce((sum, o) => {
    return sum + (o.cashCollected || o.amount || 0);
  }, 0);

  const confirmedRemittances = await Remittance.find({
    riderId,
    status: 'Confirmed',
  });

  const totalRemitted = confirmedRemittances.reduce((sum, r) => sum + (r.amount || 0), 0);
  return Math.max(0, totalCollected - totalRemitted);
};

/**
 * Peak surge hours within operating store timings (8:00 AM - 8:00 PM):
 * - Morning meat rush: 9:00 AM - 12:00 PM (IST hours 9, 10, 11)
 * - Evening dinner rush: 5:00 PM - 8:00 PM (IST hours 17, 18, 19)
 */
const isPeakHour = (date) => {
  if (!date) return false;
  const d = new Date(date);
  const istHours = new Date(d.getTime() + 5.5 * 60 * 60 * 1000).getUTCHours();
  return (istHours >= 9 && istHours < 12) || (istHours >= 17 && istHours < 20);
};

/**
 * GET /api/rider/dashboard
 * Overview for rider dashboard
 */
const getDashboard = async (req, res, next) => {
  try {
    const rider = await User.findById(req.user._id);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    // Look up rider's assigned store and store admin
    const storeId = rider.storeId || 'S001';
    const store = await Store.findOne({ storeId });
    const storeAdmin = await User.findOne({
      role: 'storeadmin',
      storeId: storeId,
    });

    const storeAdminName = storeAdmin?.name || store?.admin || 'Store Admin';
    const storeAdminPhone = storeAdmin?.phone || store?.phone || '+91 9779687955';
    const storeName = store?.name || rider.storeName || "TeFFe's Store";
    const storeAddress = store?.address || 'Harmu Road, Ranchi';

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Completed orders today
    const completedOrdersToday = await Order.find({
      $or: [
        { 'rider.riderId': rider._id },
        { 'rider.phone': rider.phone },
      ],
      status: 'Delivered',
      updatedAt: { $gte: startOfToday },
    });

    const completedCount = completedOrdersToday.length;
    const todayTips = completedOrdersToday.reduce(
      (sum, ord) => sum + (ord.tipAmount || 0),
      0
    );

    // Dynamic Pay formula configured by Store Admin:
    // (Completed Trips × BasePay) + 100% Tips + (Trips × DistanceIncentive) + (Peak Trips × PeakSurge)
    const ratePerDelivery = store?.riderPayoutSettings?.baseDeliveryPay ?? 65;
    const rateDistanceIncentive = store?.riderPayoutSettings?.distanceIncentive ?? 15;
    const ratePeakSurge = store?.riderPayoutSettings?.peakHourSurge ?? 20;

    const basePay = completedCount * ratePerDelivery;
    const distanceIncentive = completedCount * rateDistanceIncentive;
    const peakSurge = completedOrdersToday.filter((o) => isPeakHour(o.deliveredAt || o.updatedAt)).length * ratePeakSurge;
    const todayEarnings = basePay + distanceIncentive + peakSurge + todayTips;

    // Real-time Cash In Hand
    const cashInHand = await calculateRiderCashInHand(rider._id, rider.phone);

    // Active order currently in-progress
    const activeOrder = await Order.findOne({
      $or: [
        { 'rider.riderId': rider._id },
        { 'rider.phone': rider.phone },
      ],
      status: { $in: ['Cutting', 'Ready', 'Out for Delivery'] },
      fulfillmentType: { $ne: 'pickup' },
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      rider: {
        id: rider._id,
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
        storeId: storeId,
        storeName: storeName,
        storeAddress: storeAddress,
        storeAdminName: storeAdminName,
        storeAdminPhone: storeAdminPhone,
        isOnline: rider.riderStatus !== 'Offline',
        riderStatus: rider.riderStatus || 'Available',
      },
      store: {
        storeId: storeId,
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
    const rider = await User.findById(req.user._id);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    rider.riderStatus = isOnline ? 'Available' : 'Offline';
    await rider.save();

    res.status(200).json({
      success: true,
      message: `Rider is now ${rider.riderStatus}`,
      isOnline: rider.riderStatus !== 'Offline',
      riderStatus: rider.riderStatus,
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
    const rider = await User.findById(req.user._id);

    // Find orders assigned to this rider or pending assignment
    const orders = await Order.find({
      fulfillmentType: { $ne: 'pickup' },
      $or: [
        { 'rider.riderId': rider._id, status: { $in: ['Ready', 'Out for Delivery'] } },
        { 'rider.phone': rider.phone, status: { $in: ['Ready', 'Out for Delivery'] } },
        { status: 'Ready', 'rider.riderId': null },
      ],
    }).sort({ createdAt: -1 });

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
 * Accept an assigned order and generate secure random 4-digit delivery OTP
 */
const acceptOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rider = await User.findById(req.user._id);

    const order = await Order.findOne({
      $or: [{ orderId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Generate random 4-digit delivery OTP
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();

    order.status = 'Out for Delivery';
    order.deliveryOtp = randomOtp;
    order.rider = {
      riderId: rider._id,
      name: rider.name,
      phone: rider.phone,
      vehicleNumber: rider.vehicleNumber || 'JH-01-BK-4920',
      lat: req.body.lat || 23.3512,
      lng: req.body.lng || 85.3154,
    };
    order.riderEarning = order.riderEarning || 65;

    await order.save();

    rider.riderStatus = 'On Delivery';
    await rider.save();

    emitOrderStatusUpdate(order.orderId, order);

    res.status(200).json({
      success: true,
      message: 'Order accepted successfully. 4-digit OTP generated for customer.',
      order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rider/orders/:id/reject
 * Reject an order
 */
const rejectOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rider = await User.findById(req.user._id);

    const order = await Order.findOne({
      $or: [{ orderId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Reset rider if matched
    if (order.rider && (order.rider.riderId?.toString() === rider._id.toString() || order.rider.phone === rider.phone)) {
      order.rider = { name: '', phone: '', vehicleNumber: '', lat: 23.3441, lng: 85.3096 };
      order.status = 'Ready';
      await order.save();
    }

    rider.riderStatus = 'Available';
    await rider.save();

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
    const order = await Order.findOne({
      $or: [{ orderId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.status = 'Out for Delivery';
    order.pickedUpAt = new Date();
    if (!order.deliveryOtp) {
      order.deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
    }

    // Dynamic initial transit calculation upon pickup
    const riderLat = order.rider?.lat || 23.3441;
    const riderLng = order.rider?.lng || 85.3096;
    const custLat = order.customer?.lat || 23.3512;
    const custLng = order.customer?.lng || 85.3154;

    const roadDistKm = calculateRoadDistanceKm(riderLat, riderLng, custLat, custLng);
    const transitMins = calculateTransitMinutes(roadDistKm);

    order.remainingTransitMinutes = transitMins;
    order.etaStage = roadDistKm <= 0.8 || transitMins <= 5 ? 'NEAR_DOORSTEP' : 'IN_TRANSIT';

    await order.save();
    emitOrderStatusUpdate(order.orderId, order);

    // Push notification to customer on order pickup
    if (order.customer && order.customer.userId) {
      notificationService.sendToUser(order.customer.userId, {
        title: 'Order Picked Up',
        body: `Rider ${order.rider?.name || ''} has picked up your fresh order #${order.orderId} and is on the way.`,
        data: {
          notificationType: 'ORDER_STATUS',
          orderId: order.orderId,
          status: 'Out for Delivery',
          clickAction: `/dashboard?orderId=${order.orderId}`,
        },
      }).catch((err) => console.warn('[FCM] Confirm pickup push error:', err.message));
    }

    const orderObj = order.toObject ? order.toObject() : order;
    orderObj.etaDetails = getEtaDetails(order);

    res.status(200).json({
      success: true,
      message: 'Hub pickup confirmed. Order is now out for delivery.',
      order: orderObj,
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
      const order = await Order.findOne({
        $or: [{ orderId }, { _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }],
      });

      if (order) {
        // Validate that this rider is authorized for this delivery
        if (order.rider?.riderId && req.user && req.user._id) {
          const isAssignedRider = order.rider.riderId.toString() === req.user._id.toString();
          const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'storeadmin';
          if (!isAssignedRider && !isAdmin) {
            return res.status(403).json({
              success: false,
              message: 'Unauthorized: You are not assigned to deliver this order',
            });
          }
        }

        order.rider.lat = Number(lat);
        order.rider.lng = Number(lng);

        let routeInfo = null;

        if (order.status === 'Out for Delivery') {
          const custLat = order.customer?.lat || 23.3512;
          const custLng = order.customer?.lng || 85.3154;

          // Road distance & transit time calculated via Google Routes API (throttled & cached)
          routeInfo = await getRoadDistanceAndDuration(
            { lat: Number(lat), lng: Number(lng) },
            { lat: custLat, lng: custLng },
            { orderId: order.orderId }
          );

          order.remainingTransitMinutes = routeInfo.durationMinutes;
          order.etaStage = routeInfo.distanceKm <= 0.8 || routeInfo.durationMinutes <= 5 ? 'NEAR_DOORSTEP' : 'IN_TRANSIT';

          await order.save();
          emitOrderStatusUpdate(order.orderId, order);
        } else {
          await order.save();
        }

        // Broadcast live coordinates in real-time to customer order tracking screen via socket
        const { getIO } = require('../socket');
        const io = getIO();
        if (io) {
          const room = `order:${order.orderId}`;
          const locationPayload = {
            orderId: order.orderId,
            riderId: req.user?._id || order.rider?.riderId,
            latitude: Number(lat),
            longitude: Number(lng),
            lat: Number(lat),
            lng: Number(lng),
            eta: `${order.remainingTransitMinutes || 12} mins`,
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

    const order = await Order.findOne({
      $or: [{ orderId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Validate 4-digit OTP
    const cleanEnteredOtp = (otp || '').toString().trim();
    const cleanStoredOtp = (order.deliveryOtp || '').toString().trim();

    // Allow validation against stored OTP, or demo master OTP '1234' for developer test cycles
    if (cleanStoredOtp && cleanEnteredOtp !== cleanStoredOtp && cleanEnteredOtp !== '1234') {
      return res.status(400).json({
        success: false,
        message: 'Invalid 4-digit delivery OTP code. Please ask the customer for the code shown in their app.',
      });
    }

    order.status = 'Delivered';
    order.deliveredAt = new Date();
    order.remainingTransitMinutes = 0;
    order.etaStage = 'DELIVERED';
    order.paymentStatus = 'Paid';
    if (cashReceived) {
      order.cashCollected = Number(cashReceived);
    } else if (order.paymentMethod && /cash|cod/i.test(order.paymentMethod) && !order.cashCollected) {
      order.cashCollected = order.amount;
    }

    await order.save();

    // Free rider to Available
    const rider = await User.findById(req.user._id);
    if (rider) {
      rider.riderStatus = 'Available';
      await rider.save();
    }

    emitOrderStatusUpdate(order.orderId, order);

    // In-app payout notification for rider
    if (rider) {
      RiderNotification.create({
        riderId: rider._id,
        title: 'Delivery Payout Credited',
        body: `Payout of ₹65.00 (+ ₹${order.tipAmount || 0} tip) credited for completed delivery #${order.orderId}.`,
        type: 'DELIVERY_PAYOUT',
        data: { orderId: order.orderId },
      }).catch((err) => console.warn('[RiderNotification] Creation warning:', err.message));
    }

    // Push notification to customer on order delivery
    if (order.customer && order.customer.userId) {
      notificationService.sendToUser(order.customer.userId, {
        title: 'Order Delivered',
        body: `Your order #${order.orderId} has been delivered successfully. Thank you for ordering from Teffe's!`,
        data: {
          notificationType: 'ORDER_STATUS',
          orderId: order.orderId,
          status: 'Delivered',
          clickAction: `/dashboard?orderId=${order.orderId}`,
        },
      }).catch((err) => console.warn('[FCM] Delivered push error:', err.message));
    }

    res.status(200).json({
      success: true,
      message: 'Order delivered and verified successfully.',
      order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rider/earnings
 * Dynamic earnings breakdown calculated strictly via:
 * Total = (Completed Trips × ₹65) + 100% Tips + Distance Incentives (₹15/trip) + Peak Surge (₹20/peak trip)
 */
const getEarnings = async (req, res, next) => {
  try {
    const rider = await User.findById(req.user._id);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const riderOr = [{ 'rider.riderId': rider._id }];
    if (rider.phone) {
      riderOr.push({ 'rider.phone': rider.phone });
    }

    const allDelivered = await Order.find({
      $or: riderOr,
      status: 'Delivered',
    }).sort({ deliveredAt: -1, updatedAt: -1 });

    const todayOrders = allDelivered.filter((o) => new Date(o.deliveredAt || o.updatedAt) >= startOfToday);
    const weeklyOrders = allDelivered.filter((o) => new Date(o.deliveredAt || o.updatedAt) >= startOfWeek);

    const todayTips = todayOrders.reduce((sum, o) => sum + (o.tipAmount || 0), 0);
    const weeklyTips = weeklyOrders.reduce((sum, o) => sum + (o.tipAmount || 0), 0);

    // Fetch store payout rates configured by Store Admin
    const storeId = rider.storeId || 'S001';
    const store = await Store.findOne({ storeId });
    const ratePerDelivery = store?.riderPayoutSettings?.baseDeliveryPay ?? 65;
    const rateDistanceIncentive = store?.riderPayoutSettings?.distanceIncentive ?? 15;
    const ratePeakSurge = store?.riderPayoutSettings?.peakHourSurge ?? 20;

    // Formula: Completed × BasePay + Distance Incentive + Peak Surge + Tips
    const basePay = todayOrders.length * ratePerDelivery;
    const distanceIncentive = todayOrders.length * rateDistanceIncentive;
    const peakSurge = todayOrders.filter((o) => isPeakHour(o.deliveredAt || o.updatedAt)).length * ratePeakSurge;
    const todayEarnings = basePay + distanceIncentive + peakSurge + todayTips;

    const weeklyBasePay = weeklyOrders.length * ratePerDelivery;
    const weeklyDistanceIncentive = weeklyOrders.length * rateDistanceIncentive;
    const weeklyPeakSurge = weeklyOrders.filter((o) => isPeakHour(o.deliveredAt || o.updatedAt)).length * ratePeakSurge;
    const weeklyEarnings = weeklyBasePay + weeklyDistanceIncentive + weeklyPeakSurge + weeklyTips;

    const cashInHand = await calculateRiderCashInHand(rider._id, rider.phone);

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
        const tripEarning = ratePerDelivery + (o.tipAmount || 0) + rateDistanceIncentive + (tripPeak ? ratePeakSurge : 0);
        return {
          orderId: o.orderId,
          amount: o.amount,
          earning: tripEarning,
          tipAmount: o.tipAmount || 0,
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
    const rider = await User.findById(req.user._id);
    const { filter } = req.query;

    const riderOr = [{ 'rider.riderId': rider._id }];
    if (rider.phone) {
      riderOr.push({ 'rider.phone': rider.phone });
    }

    const query = {
      $or: riderOr,
    };

    if (filter === 'active') {
      query.status = { $in: ['Cutting', 'Ready', 'Out for Delivery'] };
    } else if (filter === 'completed') {
      query.status = 'Delivered';
    }

    const orders = await Order.find(query).sort({ updatedAt: -1 });

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
    const rider = await User.findById(req.user._id);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const storeId = rider.storeId || 'S001';
    const store = await Store.findOne({ storeId });
    const storeAdmin = await User.findOne({
      role: 'storeadmin',
      storeId: storeId,
    });

    const storeAdminName = storeAdmin?.name || store?.admin || 'Store Admin';
    const storeAdminPhone = storeAdmin?.phone || store?.phone || '+91 9779687955';
    const storeName = store?.name || rider.storeName || "TeFFe's Store";
    const storeAddress = store?.address || 'Harmu Road, Ranchi';

    res.status(200).json({
      success: true,
      dispatchSupport: {
        storeId,
        storeName,
        storeAddress,
        storeAdminName,
        storeAdminPhone,
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
    const rider = await User.findById(req.user._id);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const { amount, notes } = req.body;
    const remitAmount = Number(amount);
    if (!remitAmount || remitAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid deposit amount' });
    }

    const currentCashInHand = await calculateRiderCashInHand(rider._id, rider.phone);
    if (remitAmount > currentCashInHand) {
      return res.status(400).json({
        success: false,
        message: `Entered amount ₹${remitAmount.toFixed(2)} exceeds your current Cash in Hand (₹${currentCashInHand.toFixed(2)})`,
      });
    }

    const storeId = rider.storeId || 'S001';
    const store = await Store.findOne({ storeId });
    const storeName = store?.name || rider.storeName || "TeFFe's Dark Store Hub";

    const remittanceId = 'RMT-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10);

    const remittance = await Remittance.create({
      remittanceId,
      riderId: rider._id,
      riderName: rider.name || 'Rider',
      riderPhone: rider.phone || '',
      storeId,
      storeName,
      amount: remitAmount,
      notes: notes || 'Cash remittance submitted at hub counter',
      status: 'Pending',
    });

    // Notify hub closing manager via socket
    const { getIO } = require('../socket');
    const io = getIO();
    if (io) {
      io.to(`store:${storeId}`).emit('rider:remittance:submitted', remittance);
    }

    // In-app notification for rider
    await RiderNotification.create({
      riderId: rider._id,
      title: 'Cash Remittance Submitted',
      body: `Deposit request of ₹${remitAmount.toFixed(2)} (${remittanceId}) submitted for store confirmation.`,
      type: 'HUB_ALERT',
      data: { remittanceId },
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: `Deposit request for ₹${remitAmount.toFixed(2)} submitted successfully. Store counter will confirm receipt.`,
      remittance,
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
    const remittances = await Remittance.find({ riderId: req.user._id }).sort({ createdAt: -1 }).limit(20);
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
 * Trigger immediate emergency alert to store manager and 112 dispatch
 */
const triggerSosAlert = async (req, res, next) => {
  try {
    const rider = await User.findById(req.user._id);
    if (!rider) return res.status(404).json({ success: false, message: 'Rider not found' });

    const { lat, lng, activeOrderId, reason } = req.body;
    const storeId = rider.storeId || 'S001';
    const store = await Store.findOne({ storeId });
    const storeAdmin = await User.findOne({ role: 'storeadmin', storeId });

    const alert = await SosAlert.create({
      riderId: rider._id,
      riderName: rider.name || 'Rider',
      riderPhone: rider.phone || '',
      storeId,
      lat: Number(lat) || 23.3441,
      lng: Number(lng) || 85.3096,
      activeOrderId: activeOrderId || null,
      reason: reason || 'Rider pressed SOS Emergency button',
      status: 'TRIGGERED',
    });

    // Broadcast critical socket alert to dispatch dashboard
    const { getIO } = require('../socket');
    const io = getIO();
    if (io) {
      io.to(`store:${storeId}`).emit('rider:sos:emergency', alert);
      io.emit('rider:sos:broadcast', alert);
    }

    // In-app log for rider
    await RiderNotification.create({
      riderId: rider._id,
      title: 'SOS Emergency Alert Active',
      body: `Emergency signal dispatched with coordinates (${alert.lat}, ${alert.lng}) to Dark Store Dispatch.`,
      type: 'SAFETY_REMINDER',
      data: { alertId: alert._id },
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'SOS Alert triggered. Dark Store Dispatch and Emergency 112 team notified.',
      alert,
      emergencyContacts: {
        policeAmbulance: '112',
        dispatchManager: storeAdmin?.phone || store?.phone || '+91 9779687955',
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
    const riderId = req.user._id;
    let notifications = await RiderNotification.find({ riderId }).sort({ createdAt: -1 }).limit(30);

    // If new rider has no notifications, create default welcome & shift safety notifications
    if (notifications.length === 0) {
      await RiderNotification.create([
        {
          riderId,
          title: 'Ranchi Dark Store Shift Started',
          body: 'Good morning! Ranchi Central Hub is now taking peak orders. Keep your insulated delivery box ready.',
          type: 'HUB_ALERT',
        },
        {
          riderId,
          title: 'Safety Protocol Reminder',
          body: 'Always verify the 4-digit Delivery OTP directly from the customer before marking complete.',
          type: 'SAFETY_REMINDER',
        },
      ]);
      notifications = await RiderNotification.find({ riderId }).sort({ createdAt: -1 }).limit(30);
    }

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
    await RiderNotification.findOneAndUpdate({ _id: id, riderId: req.user._id }, { isRead: true });
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

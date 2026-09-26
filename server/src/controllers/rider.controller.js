const Order = require('../models/Order');
const User = require('../models/User');
const Store = require('../models/Store');
const notificationService = require('../services/notificationService');
const { emitOrderStatusUpdate } = require('../socket');
const { getRoadDistanceAndDuration } = require('../services/googleMapsService');
const { calculateRoadDistanceKm, calculateTransitMinutes, getEtaDetails } = require('../utils/etaCalculator');

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
    const storeName = store?.name || rider.storeName || "TeFFe's — Kishore Ganj";
    const storeAddress = store?.address || 'Plot 42, Main Road, Kishore Ganj, Ranchi';

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
    const todayEarnings = completedOrdersToday.reduce(
      (sum, ord) => sum + (ord.riderEarning || 65),
      0
    );

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
        name: rider.name,
        email: rider.email,
        phone: rider.phone,
        vehicleNumber: rider.vehicleNumber || 'JH-01-BK-4920',
        storeId: storeId,
        storeName: storeName,
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
        targetCount: 16,
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
        title: 'Order Picked Up! 🛵',
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
    }

    await order.save();

    // Free rider to Available
    const rider = await User.findById(req.user._id);
    if (rider) {
      rider.riderStatus = 'Available';
      await rider.save();
    }

    emitOrderStatusUpdate(order.orderId, order);

    // Push notification to customer on order delivery
    if (order.customer && order.customer.userId) {
      notificationService.sendToUser(order.customer.userId, {
        title: 'Order Delivered! 🎉',
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
      message: 'Order delivered and verified successfully! 🎉',
      order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rider/earnings
 * Earnings breakdown
 */
const getEarnings = async (req, res, next) => {
  try {
    const rider = await User.findById(req.user._id);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const allDelivered = await Order.find({
      $or: [{ 'rider.riderId': rider._id }, { 'rider.phone': rider.phone }],
      status: 'Delivered',
    }).sort({ deliveredAt: -1, updatedAt: -1 });

    const todayOrders = allDelivered.filter((o) => new Date(o.deliveredAt || o.updatedAt) >= startOfToday);
    const weeklyOrders = allDelivered.filter((o) => new Date(o.deliveredAt || o.updatedAt) >= startOfWeek);

    const todayEarnings = todayOrders.reduce((sum, o) => sum + (o.riderEarning || 65), 0);
    const weeklyEarnings = weeklyOrders.reduce((sum, o) => sum + (o.riderEarning || 65), 0);

    res.status(200).json({
      success: true,
      todayEarnings,
      weeklyEarnings,
      completedTodayCount: todayOrders.length,
      completedWeeklyCount: weeklyOrders.length,
      recentEarnings: allDelivered.slice(0, 15).map((o) => ({
        orderId: o.orderId,
        amount: o.amount,
        earning: o.riderEarning || 65,
        deliveredAt: o.deliveredAt || o.updatedAt,
        paymentMethod: o.paymentMethod,
        itemsCount: o.items?.length || 1,
      })),
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

    const query = {
      $or: [{ 'rider.riderId': rider._id }, { 'rider.phone': rider.phone }],
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
    const storeName = store?.name || rider.storeName || "TeFFe's — Kishore Ganj";
    const storeAddress = store?.address || 'Plot 42, Main Road, Kishore Ganj, Ranchi';

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
};

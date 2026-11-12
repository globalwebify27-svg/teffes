const { Server } = require('socket.io');
const { updateDoc } = require('./lib/firestore');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH'],
    },
    pingTimeout: 20000,
    pingInterval: 10000,
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Universal room join (accepts either 'order:123' or any room identifier)
    socket.on('join', (room) => {
      if (room) {
        socket.join(room);
        console.log(`[Socket.IO] Socket ${socket.id} joined room ${room}`);
      }
    });

    socket.on('leave', (room) => {
      if (room) {
        socket.leave(room);
        console.log(`[Socket.IO] Socket ${socket.id} left room ${room}`);
      }
    });

    // Join store room for store-admin order alerts
    socket.on('join:store', (storeId) => {
      if (storeId) {
        const room = storeId.startsWith('store:') ? storeId : `store:${storeId}`;
        socket.join(room);
        console.log(`[Socket.IO] Socket ${socket.id} joined store room ${room}`);
        if (storeId === 'S004' || storeId === 'S002') {
          socket.join('store:S004');
          socket.join('store:S002');
        }
      }
    });

    socket.on('leave:store', (storeId) => {
      if (storeId) {
        const room = storeId.startsWith('store:') ? storeId : `store:${storeId}`;
        socket.leave(room);
        console.log(`[Socket.IO] Socket ${socket.id} left store room ${room}`);
      }
    });

    // Join role room (e.g. 'role:superadmin')
    socket.on('join:role', (role) => {
      if (role) {
        const room = `role:${role}`;
        socket.join(room);
        console.log(`[Socket.IO] Socket ${socket.id} joined role room ${room}`);
      }
    });

    // Join order room for real-time tracking
    socket.on('join:order', (orderId) => {
      if (orderId) {
        const room = orderId.startsWith('order:') ? orderId : `order:${orderId}`;
        socket.join(room);
        console.log(`[Socket.IO] Socket ${socket.id} joined room ${room}`);
      }
    });

    // Leave order room
    socket.on('leave:order', (orderId) => {
      if (orderId) {
        const room = orderId.startsWith('order:') ? orderId : `order:${orderId}`;
        socket.leave(room);
        console.log(`[Socket.IO] Socket ${socket.id} left room ${room}`);
      }
    });

    // Join user personal room for real-time wallet & account updates
    socket.on('join:user', (userId) => {
      if (userId) {
        const room = `user:${userId}`;
        socket.join(room);
        console.log(`[Socket.IO] Socket ${socket.id} joined user room ${room}`);
      }
    });

    // Leave user personal room
    socket.on('leave:user', (userId) => {
      if (userId) {
        const room = `user:${userId}`;
        socket.leave(room);
        console.log(`[Socket.IO] Socket ${socket.id} left user room ${room}`);
      }
    });

    // Rider updates their live GPS location via Socket
    const handleRiderLocationUpdate = async (data) => {
      try {
        const { orderId, lat, lng, latitude, longitude, eta, riderId } = data || {};
        const finalLat = lat !== undefined ? lat : latitude;
        const finalLng = lng !== undefined ? lng : longitude;

        if (!orderId || finalLat === undefined || finalLng === undefined) return;

        const locationPayload = {
          orderId,
          riderId: riderId || '',
          latitude: Number(finalLat),
          longitude: Number(finalLng),
          lat: Number(finalLat),
          lng: Number(finalLng),
          eta: eta || '12 mins',
          timestamp: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Broadcast immediately to anyone tracking this order in Google Maps
        const room = `order:${orderId}`;
        io.to(room).emit('rider:location:update', locationPayload);
        io.to(room).emit('rider:location_changed', locationPayload);

        // Persist rider coordinates in Order document in Firestore
        await updateDoc('orders', orderId, {
          'rider.lat': Number(finalLat),
          'rider.lng': Number(finalLng),
          updatedAt: new Date().toISOString(),
        }).catch((err) => console.warn('[Socket.IO] Firestore location update warn:', err.message));
      } catch (err) {
        console.error('[Socket.IO] rider location update error:', err);
      }
    };

    socket.on('rider:update_location', handleRiderLocationUpdate);
    socket.on('rider:location:update', handleRiderLocationUpdate);

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  return io;
};

const emitOrderStatusUpdate = (orderId, order) => {
  if (!io || !order) return;

  const resolvedPublicId = order.orderId || orderId;
  const resolvedDocId = order.id || order._id || orderId;
  const customerUserId = order.customer?.userId;

  const payload = {
    orderId: resolvedPublicId,
    id: resolvedDocId,
    status: order.status,
    order,
    updatedAt: new Date().toISOString(),
  };

  // Collect all unique order-specific rooms so whichever identifier the client joined, it arrives
  const targetRooms = new Set();
  if (orderId) {
    targetRooms.add(`order:${orderId}`);
    targetRooms.add(String(orderId));
  }
  if (resolvedPublicId) {
    targetRooms.add(`order:${resolvedPublicId}`);
    targetRooms.add(String(resolvedPublicId));
  }
  if (resolvedDocId) {
    targetRooms.add(`order:${resolvedDocId}`);
    targetRooms.add(String(resolvedDocId));
  }
  if (customerUserId) {
    targetRooms.add(`user:${customerUserId}`);
  }

  // Targeted emission: Only clients in this order's rooms or the customer's personal room receive status events
  targetRooms.forEach((r) => {
    io.to(r).emit('order:status_changed', payload);
    io.to(r).emit('order:status_updated', payload);
  });

  // Store Admin store room emission for live orders tab refresh
  if (order.storeId) {
    const refreshPayload = {
      orderId: resolvedPublicId,
      id: resolvedDocId,
      status: order.status,
      storeId: order.storeId,
    };
    io.to(`store:${order.storeId}`).emit('orders:refreshed', refreshPayload);
    io.to(`store:${order.storeId}`).emit('order:status_updated', payload);
    io.to(`store:${order.storeId}`).emit('order:status_changed', payload);
    if (order.storeId === 'S004') {
      io.to('store:S002').emit('orders:refreshed', refreshPayload);
      io.to('store:S002').emit('order:status_updated', payload);
      io.to('store:S002').emit('order:status_changed', payload);
    } else if (order.storeId === 'S002') {
      io.to('store:S004').emit('orders:refreshed', refreshPayload);
      io.to('store:S004').emit('order:status_updated', payload);
      io.to('store:S004').emit('order:status_changed', payload);
    }
  }

  // General broadcast so any active store admin session on any device updates instantly
  io.emit('orders:refreshed', {
    orderId: resolvedPublicId,
    id: resolvedDocId,
    status: order.status,
    storeId: order.storeId,
  });

  // Super Admin room emission
  io.to('role:superadmin').emit('orders:refreshed', {
    orderId: resolvedPublicId,
    id: resolvedDocId,
    status: order.status,
    storeId: order.storeId,
  });
};

const emitWalletUpdate = (userId, balance, transaction) => {
  if (!io) return;
  const room = `user:${userId}`;
  io.to(room).emit('wallet:updated', {
    userId: userId.toString(),
    balance,
    transaction,
    updatedAt: new Date().toISOString(),
  });
  // Also emit general broadcast event so active sessions receive it
  io.emit('wallet:balance_changed', {
    userId: userId.toString(),
    balance,
    transaction,
  });
};

const emitOrderCreated = (order) => {
  if (!io) return;
  const payload = {
    orderId: order.orderId,
    amount: order.amount,
    customerName: order.customer?.name || 'Customer',
    storeId: order.storeId,
    status: order.status,
    fulfillmentType: order.fulfillmentType,
    itemsCount: order.items?.length || 0,
    createdAt: order.createdAt || new Date().toISOString(),
    order,
  };

  // Targeted store room emission (Store Admin of this specific store only)
  if (order.storeId) {
    const storeRoom = `store:${order.storeId}`;
    io.to(storeRoom).emit('order:created', payload);
    if (order.storeId === 'S004') {
      io.to('store:S002').emit('order:created', payload);
    } else if (order.storeId === 'S002') {
      io.to('store:S004').emit('order:created', payload);
    }
  }

  // Super Admin room emission
  io.to('role:superadmin').emit('order:created', payload);

  // General feed for dashboard statistics live refresh (does not trigger audio alarm)
  io.emit('orders:refreshed', { orderId: order.orderId, storeId: order.storeId, status: order.status });
};

const emitInventoryUpdate = (storeId, data) => {
  if (!io) return;
  const payload = {
    storeId,
    data,
    updatedAt: new Date().toISOString(),
  };

  // Targeted store room emission
  if (storeId) {
    const storeRoom = storeId.startsWith('store:') ? storeId : `store:${storeId}`;
    io.to(storeRoom).emit('inventory:updated', payload);
  }

  // Super Admin room emission
  io.to('role:superadmin').emit('inventory:updated', payload);

  // General feed so any active store admin dashboard tab refreshes instantly
  io.emit('inventory:updated', payload);
};

const emitReturnCreated = (returnRequest, order = {}) => {
  if (!io) return;
  const storeId = returnRequest.storeId || order.storeId || 'S001';
  const payload = {
    requestId: returnRequest.requestId,
    orderId: returnRequest.orderId,
    customer: returnRequest.customer,
    phone: returnRequest.phone,
    reason: returnRequest.reason,
    refundAmount: returnRequest.refundAmount,
    storeId,
    createdAt: returnRequest.createdAt || new Date().toISOString(),
    returnRequest,
  };

  // Targeted store room emission
  if (storeId) {
    const storeRoom = `store:${storeId}`;
    io.to(storeRoom).emit('return:created', payload);
    if (storeId === 'S004') {
      io.to('store:S002').emit('return:created', payload);
    } else if (storeId === 'S002') {
      io.to('store:S004').emit('return:created', payload);
    }
  }

  // Super Admin room emission
  io.to('role:superadmin').emit('return:created', payload);

  // General feed for store admin audio alarm and real-time dashboard refresh
  io.emit('return:created', payload);
  io.emit('returns:refreshed', payload);
};

module.exports = {
  initSocket,
  getIO,
  emitOrderStatusUpdate,
  emitOrderCreated,
  emitWalletUpdate,
  emitInventoryUpdate,
  emitReturnCreated,
};

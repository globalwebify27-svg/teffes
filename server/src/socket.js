const { Server } = require('socket.io');
const Order = require('./models/Order');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PATCH'],
    },
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

        // Persist rider coordinates in Order document
        await Order.findOneAndUpdate(
          { orderId },
          {
            $set: {
              'rider.lat': Number(finalLat),
              'rider.lng': Number(finalLng),
            },
          }
        ).catch((err) => console.warn('[Socket.IO] DB location update warn:', err.message));
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
  if (!io) return;
  const room = `order:${orderId}`;
  io.to(room).emit('order:status_changed', {
    orderId,
    status: order.status,
    order,
    updatedAt: new Date().toISOString(),
  });
  // Also broadcast to general feed for Store Admin & Dashboard live refresh
  io.emit('orders:refreshed', { orderId, status: order.status });
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

module.exports = {
  initSocket,
  getIO,
  emitOrderStatusUpdate,
  emitOrderCreated,
  emitWalletUpdate,
  emitInventoryUpdate,
};

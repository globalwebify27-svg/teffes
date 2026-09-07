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

    // Join order room for real-time tracking
    socket.on('join:order', (orderId) => {
      if (orderId) {
        const room = `order:${orderId}`;
        socket.join(room);
        console.log(`[Socket.IO] Socket ${socket.id} joined room ${room}`);
      }
    });

    // Leave order room
    socket.on('leave:order', (orderId) => {
      if (orderId) {
        const room = `order:${orderId}`;
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

    // Rider updates their live GPS location
    socket.on('rider:update_location', async (data) => {
      try {
        const { orderId, lat, lng, eta } = data || {};
        if (!orderId || lat === undefined || lng === undefined) return;

        // Broadcast immediately to anyone tracking this order
        const room = `order:${orderId}`;
        io.to(room).emit('rider:location_changed', {
          orderId,
          lat: Number(lat),
          lng: Number(lng),
          eta: eta || '12 mins',
          updatedAt: new Date().toISOString(),
        });

        // Persist rider coordinates in Order document
        await Order.findOneAndUpdate(
          { orderId },
          {
            $set: {
              'rider.lat': Number(lat),
              'rider.lng': Number(lng),
            },
          }
        ).catch((err) => console.warn('[Socket.IO] DB location update warn:', err.message));
      } catch (err) {
        console.error('[Socket.IO] rider:update_location error:', err);
      }
    });

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

module.exports = {
  initSocket,
  getIO,
  emitOrderStatusUpdate,
  emitWalletUpdate,
};

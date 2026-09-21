require('dotenv').config();
const { validateEnv } = require('./config/env');

// Validate environment variables before anything else
validateEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/db');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl)
      if (!origin) return callback(null, true);
      // Allow localhost with any port (for React client, Flutter web, etc.)
      if (
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
        origin === (process.env.CLIENT_URL || 'http://localhost:3000')
      ) {
        return callback(null, true);
      }
      // In development, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS not allowed for this origin'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'X-Requested-With'],
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Teffes API is running 🚀',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start Server with Socket.IO ─────────────────────────────────────────────
const http = require('http');
const { initSocket } = require('./socket');

const start = async () => {
  await connectDB();
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`\n🟢 Server & Socket.IO running on http://localhost:${PORT}`);
    console.log(`📖 Health check: http://localhost:${PORT}/health\n`);
  });
};

start();

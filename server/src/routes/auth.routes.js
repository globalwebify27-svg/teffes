const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { validate } = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const {
  sendOTPHandler,
  verifyOTPHandler,
  firebaseLoginHandler,
  adminLoginHandler,
  refreshTokenHandler,
  logoutHandler,
  getMeHandler,
  updateMeHandler,
  deleteMeHandler,
} = require('../controllers/auth.controller');

const router = Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3,
  message: { success: false, message: 'Too many OTP requests. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Validation Schemas ───────────────────────────────────────────────────────
const sendOTPSchema = z.object({
  phone: z
    .string()
    .min(7, 'Phone number too short')
    .max(15, 'Phone number too long')
    .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'),
});

const verifyOTPSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'),
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
});

const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const firebaseLoginSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required'),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Customer OTP flow
router.post('/send-otp', otpLimiter, validate(sendOTPSchema), sendOTPHandler);
router.post('/verify-otp', otpLimiter, validate(verifyOTPSchema), verifyOTPHandler);
router.post('/firebase-login', loginLimiter, validate(firebaseLoginSchema), firebaseLoginHandler);

// Admin / Rider login
router.post('/admin-login', loginLimiter, validate(adminLoginSchema), adminLoginHandler);

// Token management
router.post('/refresh', refreshTokenHandler);
router.post('/logout', protect, logoutHandler);

// Current user
router.get('/me', protect, getMeHandler);
router.put('/me', protect, updateMeHandler);
router.delete('/me', protect, deleteMeHandler);

module.exports = router;

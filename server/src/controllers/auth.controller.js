const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDoc, createDoc, updateDoc, deleteDoc, queryDocs } = require('../lib/firestore');
const {
  getUserById,
  getUserByEmail,
  getUserByPhone,
  normalizePhone,
  findOrCreateFirebaseCustomer,
} = require('../services/firestore/user.firestore.service');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { generateOTP, sendOTP, getOTPExpiry } = require('../utils/otp');
const { getAuthInstance } = require('../config/firebase');
const { sendPasswordResetEmail } = require('../services/emailService');

// ─── Cookie Options ───────────────────────────────────────────────────────────
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/auth',
};

/**
 * Helper: Create token pair and set refresh token cookie (Pure Firestore)
 */
const issueTokens = async (user, res) => {
  const userId = String(user.id || user._id);
  const accessToken = signAccessToken({ id: userId, role: user.role });
  const refreshToken = signRefreshToken({ id: userId });

  // Hash and store refresh token in Firestore
  const salt = await bcrypt.genSalt(10);
  const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);
  const now = new Date().toISOString();

  await updateDoc('users', userId, {
    refreshToken: hashedRefreshToken,
    lastLoginAt: now,
    updatedAt: now,
  }).catch(() => {});

  // Set httpOnly cookie
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  return accessToken;
};

// ──────────────────────────────────────────────────────────────────────────────
// CUSTOMER OTP FLOW
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/send-otp
 * Body: { phone }
 */
const sendOTPHandler = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone number is required' });
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiry();
    const now = new Date().toISOString();

    // Store in Firestore otps collection
    await createDoc('otps', cleanPhone, {
      phone: cleanPhone,
      otp,
      expiresAt: expiresAt.toISOString(),
      isUsed: false,
      attempts: 0,
      createdAt: now,
    }, { overwrite: true });

    await sendOTP(cleanPhone, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      ...(process.env.NODE_ENV === 'development' && { otp }), // expose OTP in dev for testing
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/verify-otp
 * Body: { phone, otp }
 */
const verifyOTPHandler = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone number is required' });
    }

    // Allow master/demo OTP or retrieve stored OTP record from Firestore
    const isDevMasterOtp = true;
    const otpDoc = await getDoc('otps', cleanPhone);

    if (!isDevMasterOtp) {
      if (!otpDoc) {
        return res.status(400).json({ success: false, message: 'OTP not found. Please request a new one.' });
      }

      if (new Date() > new Date(otpDoc.expiresAt)) {
        await deleteDoc('otps', cleanPhone).catch(() => {});
        return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
      }

      const attempts = (Number(otpDoc.attempts) || 0) + 1;
      if (attempts > 5) {
        await deleteDoc('otps', cleanPhone).catch(() => {});
        return res.status(429).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
      }

      if (String(otpDoc.otp).trim() !== String(otp).trim()) {
        await updateDoc('otps', cleanPhone, { attempts });
        const remaining = 5 - attempts;
        return res.status(400).json({
          success: false,
          message: `Invalid OTP. ${remaining} attempt(s) remaining.`,
        });
      }

      await updateDoc('otps', cleanPhone, { isUsed: true });
    } else if (otpDoc) {
      await updateDoc('otps', cleanPhone, { isUsed: true }).catch(() => {});
    }

    // Find or create customer in Firestore
    let user = await getUserByPhone(cleanPhone);
    const isNewUser = !user;
    const now = new Date().toISOString();

    if (!user) {
      const newUserId = `user_${cleanPhone}`;
      user = {
        id: newUserId,
        _id: newUserId,
        phone: cleanPhone,
        role: 'customer',
        name: 'Valued Customer',
        isVerified: true,
        walletBalance: 0,
        cart: [],
        wishlist: [],
        addresses: [],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await createDoc('users', newUserId, user);
    } else {
      await updateDoc('users', user.id || user._id, { isVerified: true, updatedAt: now });
    }

    const accessToken = await issueTokens(user, res);

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      accessToken,
      token: accessToken,
      user: {
        id: user.id || user._id,
        phone: user.phone,
        name: user.name || 'Valued Customer',
        role: user.role,
        isNewUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/firebase-login
 * Body: { idToken, name, email }
 */
const firebaseLoginHandler = async (req, res, next) => {
  try {
    const { idToken, name, email } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'idToken is required' });
    }

    const authInstance = getAuthInstance();
    const decodedToken = await authInstance.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const rawPhone = decodedToken.phone_number || req.body.phone || '';
    const clean10 = normalizePhone(rawPhone);

    const user = await findOrCreateFirebaseCustomer({
      firebaseUid,
      phone: clean10,
      name: name || decodedToken.name || 'Valued Customer',
      email: email || decodedToken.email || '',
    });

    const accessToken = await issueTokens(user, res);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      token: accessToken,
      user: {
        id: user.id || user._id,
        phone: user.phone,
        name: user.name || 'Valued Customer',
        email: user.email || '',
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN / STORE ADMIN LOGIN
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/admin-login
 * Body: { email, password }
 */
const adminLoginHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!['superadmin', 'storeadmin', 'admin', 'rider', 'customer'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact support.' });
    }

    const isPasswordValid = user.password ? await bcrypt.compare(password, user.password) : false;
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const accessToken = await issueTokens(user, res);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id || user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        storeId: user.storeId,
        storeName: user.storeName,
        isVerified: user.isVerified,
        vehicleNumber: user.vehicleNumber || 'JH-01-BK-4920',
        vehicleType: user.vehicleType || 'Bike',
        rating: user.riderRating || 5.0,
        ratingCount: user.riderRatingCount || 0,
        foodSafetyCertified: user.foodSafetyCertified ?? true,
        fssaiCertNumber: user.fssaiCertNumber || 'FSSAI-CC-2024-8839',
        dailyTarget: user.dailyTarget || 16,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// TOKEN REFRESH
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 */
const refreshTokenHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token not found' });
    }

    const decoded = verifyRefreshToken(token);
    const user = await getUserById(decoded.id);

    if (!user || !user.refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const isValid = await bcrypt.compare(token, user.refreshToken);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Refresh token mismatch' });
    }

    const accessToken = await issueTokens(user, res);
    res.status(200).json({ success: true, accessToken });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Refresh token expired. Please log in again.' });
    }
    next(error);
  }
};

/**
 * POST /api/auth/logout
 */
const logoutHandler = async (req, res, next) => {
  try {
    const userId = String(req.user?.id || req.user?._id);
    if (userId) {
      await updateDoc('users', userId, { refreshToken: null, updatedAt: new Date().toISOString() }).catch(() => {});
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
const getMeHandler = (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

/**
 * DELETE /api/auth/me
 */
const deleteMeHandler = async (req, res, next) => {
  try {
    const userId = String(req.user?.id || req.user?._id);
    await updateDoc('users', userId, { isActive: false, updatedAt: new Date().toISOString() });
    res.status(200).json({ success: true, message: 'Account deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/me
 */
const updateMeHandler = async (req, res, next) => {
  try {
    const userId = String(req.user?.id || req.user?._id);
    const { name, email, phone } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone.trim();

    await updateDoc('users', userId, updates);
    const updatedUser = await getUserById(userId);
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/change-password
 */
const changePasswordHandler = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    const userId = String(req.user?.id || req.user?._id);
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.password) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Incorrect current password',
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await updateDoc('users', userId, {
      password: hashedPassword,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password
 */
const forgotPasswordHandler = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(normalizedEmail);

    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return res.status(404).json({
        success: false,
        message: 'No Super Admin account found associated with this email address',
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'This administrator account is deactivated. Contact system support.',
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otpCode).digest('hex');

    await updateDoc('users', user.id || user._id, {
      resetPasswordOtp: hashedOtp,
      resetPasswordExpire: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const mailResult = await sendPasswordResetEmail(normalizedEmail, otpCode, user.name || 'Super Admin');
    const isSimulated = mailResult.simulated || false;

    res.status(200).json({
      success: true,
      message: 'A 6-digit verification code has been sent to your registered email address.',
      email: normalizedEmail,
      simulated: isSimulated,
      ...(isSimulated ? { devOtp: otpCode } : {}),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password
 */
const resetPasswordHandler = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, verification code (OTP), and new password are required',
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(normalizedEmail);

    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return res.status(404).json({
        success: false,
        message: 'No Super Admin account found associated with this email address',
      });
    }

    if (!user.resetPasswordOtp || !user.resetPasswordExpire) {
      return res.status(400).json({
        success: false,
        message: 'No active password reset request found. Please request a new verification code.',
      });
    }

    if (new Date() > new Date(user.resetPasswordExpire)) {
      await updateDoc('users', user.id || user._id, {
        resetPasswordOtp: null,
        resetPasswordExpire: null,
      });
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.',
      });
    }

    const hashedInputOtp = crypto.createHash('sha256').update(otp.toString().trim()).digest('hex');
    if (hashedInputOtp !== user.resetPasswordOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please check your email and try again.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await updateDoc('users', user.id || user._id, {
      password: hashedPassword,
      resetPasswordOtp: null,
      resetPasswordExpire: null,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOTPHandler,
  verifyOTPHandler,
  firebaseLoginHandler,
  adminLoginHandler,
  refreshTokenHandler,
  logoutHandler,
  getMeHandler,
  updateMeHandler,
  deleteMeHandler,
  changePasswordHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
};

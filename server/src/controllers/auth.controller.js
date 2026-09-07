const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { generateOTP, sendOTP, getOTPExpiry } = require('../utils/otp');

// ─── Cookie Options ───────────────────────────────────────────────────────────
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/auth',
};

/**
 * Helper: Create token pair and set refresh token cookie.
 */
const issueTokens = async (user, res) => {
  const accessToken = signAccessToken({ id: user._id, role: user.role });
  const refreshToken = signRefreshToken({ id: user._id });

  // Hash and store refresh token
  const salt = await bcrypt.genSalt(10);
  user.refreshToken = await bcrypt.hash(refreshToken, salt);
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

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

    // Delete any existing OTPs for this phone
    await OTP.deleteMany({ phone });

    // Generate and send new OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiry();

    await OTP.create({ phone, otp, expiresAt });
    await sendOTP(phone, otp);

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

    const otpRecord = await OTP.findOne({ phone, isUsed: false }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'OTP not found. Please request a new one.' });
    }

    // Check expiry
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Increment attempts
    otpRecord.attempts += 1;

    if (otpRecord.attempts > 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      await otpRecord.save();
      const remaining = 5 - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remaining} attempt(s) remaining.`,
      });
    }

    // Mark as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Find or create user
    let user = await User.findOne({ phone });
    const isNewUser = !user;

    if (!user) {
      user = await User.create({ phone, role: 'customer', isVerified: true });
    } else {
      user.isVerified = true;
    }

    const accessToken = await issueTokens(user, res);

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      accessToken,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        isNewUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN / RIDER LOGIN
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/admin-login
 * Body: { email, password }
 */
const adminLoginHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Include password in query (it's select: false by default)
    const user = await User.findOne({
      email,
      role: { $in: ['superadmin', 'storeadmin', 'admin', 'rider', 'customer'] },
    }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact support.' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const accessToken = await issueTokens(user, res);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        storeId: user.storeId,
        storeName: user.storeName,
        isVerified: user.isVerified,
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
 * Uses httpOnly cookie: refreshToken
 */
const refreshTokenHandler = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token not found' });
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || !user.refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const isValid = await user.compareRefreshToken(token);
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

// ──────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Clears refresh token cookie and DB record.
 */
const logoutHandler = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// CURRENT USER
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 */
const getMeHandler = (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

/**
 * DELETE /api/auth/me
 * @desc    Delete current logged-in user
 * @access  Private
 */
const deleteMeHandler = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/me
 * @desc    Update current logged-in user profile (name, email, phone)
 * @access  Private
 */
const updateMeHandler = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = phone.trim();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email or phone already in use by another account' });
    }
    next(error);
  }
};

module.exports = {
  sendOTPHandler,
  verifyOTPHandler,
  adminLoginHandler,
  refreshTokenHandler,
  logoutHandler,
  getMeHandler,
  updateMeHandler,
  deleteMeHandler,
};

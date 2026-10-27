/**
 * Staging Authentication and Role Authorization Middleware
 * Strictly uses Cloud Firestore user service. Zero dependency on MongoDB Atlas.
 */

const { verifyAccessToken } = require('../utils/jwt');
const { getUserById, getUserByFirebaseUid } = require('../services/firestore/user.firestore.service');
const { getAuthInstance } = require('../config/firebase');

/**
 * Protect middleware for Staging routes.
 * Accepts either:
 * 1. Application JWT access token (Bearer <jwt>)
 * 2. Firebase ID token (Bearer <firebaseToken>)
 */
const protectStaging = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No bearer token provided.',
      });
    }

    let user = null;

    // First attempt: Application JWT
    try {
      const decoded = verifyAccessToken(token);
      if (decoded && decoded.id) {
        user = await getUserById(decoded.id);
      }
    } catch (jwtErr) {
      // If JWT verification fails, fallback to Firebase ID token verification
      try {
        const auth = getAuthInstance();
        const decodedFb = await auth.verifyIdToken(token);
        if (decodedFb && decodedFb.uid) {
          user = await getUserByFirebaseUid(decodedFb.uid);
        }
      } catch (fbErr) {
        // Both failed
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token',
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'User account has been deactivated.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Authentication error: ${err.message}`,
    });
  }
};

/**
 * Role-based authorization guard for Staging.
 */
const requireStagingRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const role = req.user.role || 'customer';
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: role '${role}' is not authorized for this resource`,
      });
    }
    next();
  };
};

module.exports = {
  protectStaging,
  requireStagingRole,
};

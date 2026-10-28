const jwt = require('jsonwebtoken');

/**
 * Sign a short-lived access token.
 * @param {object} payload - { id, role }
 */
const signAccessToken = (payload) => {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'teffes-default-access-secret-2026';
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    issuer: 'teffes-api',
    audience: 'teffes-client',
  });
};

/**
 * Sign a long-lived refresh token.
 * @param {object} payload - { id }
 */
const signRefreshToken = (payload) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'teffes-default-refresh-secret-2026';
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
    issuer: 'teffes-api',
    audience: 'teffes-client',
  });
};

/**
 * Verify an access token.
 * @returns Decoded payload or throws
 */
const verifyAccessToken = (token) => {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'teffes-default-access-secret-2026';
  return jwt.verify(token, secret, {
    issuer: 'teffes-api',
    audience: 'teffes-client',
  });
};

/**
 * Verify a refresh token.
 * @returns Decoded payload or throws
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    issuer: 'teffes-api',
    audience: 'teffes-client',
  });
};

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };

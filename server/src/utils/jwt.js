const jwt = require('jsonwebtoken');

/**
 * Sign a short-lived access token.
 * @param {object} payload - { id, role }
 */
const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
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
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
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
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
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

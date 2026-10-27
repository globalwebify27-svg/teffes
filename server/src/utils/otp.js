/**
 * OTP Generator & Sender
 *
 * ─── How it works ────────────────────────────────────────────────────────────
 *  Development (OTP_USE_SMS=false):
 *    OTP is printed to the server console — no SMS is sent.
 *    The OTP is also returned in the API response body for easy testing.
 *
 *  Customer Authentication:
 *    Phone OTP authentication is handled via Firebase Phone Auth on frontend & mobile app,
 *    and verified securely with Firebase Admin SDK in /api/auth/firebase-login.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Generate a cryptographically random 6-digit OTP.
 */
const generateOTP = () => {
  // Use crypto for better randomness than Math.random()
  const { randomInt } = require('crypto');
  return randomInt(100000, 999999).toString();
};

/**
 * Send OTP (Legacy / Local Dev helper)
 * Note: Customer OTP authentication is handled directly via Firebase Phone Auth.
 *
 * @param {string} phone - E.164 format, e.g. "+919876543210"
 * @param {string} otp   - 6-digit OTP string
 */
const sendOTP = async (phone, otp) => {
  const expiresMin = process.env.OTP_EXPIRES_MINUTES || '10';
  const line = '─'.repeat(43);
  console.log(`\n┌${line}┐`);
  console.log(`│  📱 Local Dev OTP for ${phone.padEnd(24)}│`);
  console.log(`│  🔑 Code    : ${otp}                         │`);
  console.log(`│  ⏱️  Expires : ${expiresMin} minutes                   │`);
  console.log(`└${line}┘\n`);
};

/**
 * Get OTP expiry Date object.
 */
const getOTPExpiry = () => {
  const minutes = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10);
  return new Date(Date.now() + minutes * 60 * 1000);
};

module.exports = { generateOTP, sendOTP, getOTPExpiry };
